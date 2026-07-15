import type { Prefs } from "../config/prefs.ts";
import { savePrefs } from "../config/prefs.ts";
import type { GitLabClient } from "../gitlab/client.ts";
import {
  firstFailedJobName,
  groupJobsByStage,
  mapBridge,
  mapJob,
  mapPipeline,
  mapProject,
  projectActivityRankMs,
} from "../gitlab/map.ts";
import type { Project } from "../gitlab/types.ts";
import { isActiveStatus } from "../gitlab/types.ts";
import { buildProjectView } from "../projects/filter.ts";
import type { RootStores } from "../state/root.ts";
import { logger } from "../util/logger.ts";
import { parkLogOnFirstError } from "../util/logNav.ts";
import { sanitizeTrace, tailLines } from "../util/sanitizeTrace.ts";
import type { JobHandler } from "./queue.ts";
import type { JobRequest } from "./jobs.ts";

function isSilent(req: JobRequest): boolean {
  return req.silent === true || req.band === "poll";
}

export type EnqueueFn = (req: JobRequest) => void | Promise<void>;

/** Prefer last-good items; loading only on cold start; silent never flashes loading. */
function beginSliceStatus(
  silent: boolean,
  hasItems: boolean,
): "loading" | "stale" | null {
  if (silent) return hasItems ? "stale" : null;
  return hasItems ? "stale" : "loading";
}

function sortProjectsForStore(items: Project[]): Project[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    const da = projectActivityRankMs(a);
    const db = projectActivityRankMs(b);
    if (db !== da) return db - da;
    return a.pathWithNamespace.localeCompare(b.pathWithNamespace);
  });
}

function mergePulseFields(
  prev: Project[],
  next: Project[],
): Project[] {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  return next.map((p) => {
    const old = prevById.get(p.id);
    if (!old) return p;
    return {
      ...p,
      pulseStatus: old.pulseStatus,
      lastPipelineAt: old.lastPipelineAt ?? p.lastPipelineAt,
    };
  });
}

function rebindProjectCursor(
  stores: RootStores,
  prevItems: Project[],
  nextItems: Project[],
): void {
  const chrome = stores.chrome.get();
  const prefs = stores.prefs.get();
  const query =
    chrome.filterActive && chrome.focusedPane === "projects"
      ? chrome.filterDraft
      : chrome.projectFilter;
  const viewOpts = {
    query,
    scope: chrome.projectScope,
    recent: prefs.recentProjects,
    recentMode: prefs.recentMode,
    recentExpanded: chrome.recentExpanded,
  };
  const prevFlat = buildProjectView(prevItems, viewOpts).flat;
  const nextFlat = buildProjectView(nextItems, viewOpts).flat;
  if (nextFlat.length === 0) {
    if (chrome.projectCursor !== 0) stores.chrome.patch({ projectCursor: 0 });
    return;
  }
  const anchorId = prevFlat[chrome.projectCursor]?.id;
  if (anchorId != null) {
    const idx = nextFlat.findIndex((p) => p.id === anchorId);
    if (idx >= 0) {
      if (idx !== chrome.projectCursor) stores.chrome.patch({ projectCursor: idx });
      return;
    }
  }
  if (chrome.projectCursor >= nextFlat.length) {
    stores.chrome.patch({ projectCursor: nextFlat.length - 1 });
  }
}

function enqueuePulses(items: Project[], stores: RootStores, enqueue: EnqueueFn): void {
  const prefs = stores.prefs.get();
  const recent = new Set(prefs.recentProjects);
  const pulseIds: number[] = [];

  for (const p of items) {
    if (p.pinned || recent.has(p.pathWithNamespace)) pulseIds.push(p.id);
    if (pulseIds.length >= 20) break;
  }
  // Top by activity (list already activity-sorted for unpinned after pins)
  for (const p of items) {
    if (!pulseIds.includes(p.id)) pulseIds.push(p.id);
    if (pulseIds.length >= 24) break;
  }
  for (const id of pulseIds.slice(0, 24)) {
    void enqueue({
      kind: "LoadPulse",
      key: `pulse:${id}`,
      band: "idle",
      projectId: id,
      silent: true,
    });
  }
}

export function createHandlers(
  client: GitLabClient,
  stores: RootStores,
  enqueue: EnqueueFn = () => {},
): Record<string, JobHandler> {
  const loadProjects: JobHandler = async (req) => {
    const silent = isSilent(req);
    const hostAtStart = client.host;
    const prev = stores.projects.get();
    const nextStatus = beginSliceStatus(silent, prev.items.length > 0);
    if (nextStatus) {
      stores.projects.patch({ status: nextStatus, error: null });
    }
    try {
      const raw = await client.listProjects(req.signal);
      // Stale host / aborted session
      if (client.host !== hostAtStart) return;

      const pins = new Set(stores.prefs.get().pins);
      let items = raw.map((r) => mapProject(r, pins.has(String(r.path_with_namespace))));
      items = sortProjectsForStore(items);
      // Keep pulse glyphs across silent/user refresh
      items = mergePulseFields(prev.items, items);

      stores.projects.set({ items, status: "ready", error: null, scopeId: null });
      rebindProjectCursor(stores, prev.items, items);
      enqueuePulses(items, stores, enqueue);
      logger.debug("projects_loaded", { count: items.length, silent });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      if (client.host !== hostAtStart) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (silent) {
        stores.queueMeta.patch({ lastError: msg });
        // keep last-good items; clear soft stale if we never left ready
        if (stores.projects.get().status === "stale") {
          stores.projects.patch({ status: prev.items.length ? "ready" : "error", error: null });
        }
        logger.warn("projects_refresh_failed", { err: msg });
        return;
      }
      // user-facing error but preserve last-good items
      stores.projects.patch({
        status: prev.items.length ? "ready" : "error",
        error: msg,
      });
      logger.error("projects_load_failed", { err: msg });
      throw e;
    }
  };

  const loadPipelines: JobHandler = async (req) => {
    const projectId = req.projectId!;
    const gen = req.gen ?? stores.selection.get().projectGen;
    const silent = isSilent(req);
    const prev = stores.pipelines.get();
    if (!silent) {
      const st = beginSliceStatus(false, prev.items.length > 0 && prev.scopeId === projectId);
      if (st === "loading") {
        stores.pipelines.set({
          items: [],
          status: "loading",
          error: null,
          scopeId: projectId,
        });
      } else if (st === "stale") {
        stores.pipelines.patch({ status: "stale", error: null, scopeId: projectId });
      }
    } else if (prev.items.length > 0 && prev.scopeId === projectId) {
      stores.pipelines.patch({ status: "stale" });
    }
    try {
      const raw = await client.listPipelines(projectId, req.signal);
      if (stores.selection.get().projectGen !== gen) return;
      let items = raw.map(mapPipeline);
      const jobs = stores.jobs.get();
      if (jobs.scopeId && items[0] && jobs.scopeId === items[0].id) {
        const name = firstFailedJobName(jobs.items);
        if (name) items = items.map((p, i) => (i === 0 ? { ...p, failedJobName: name } : p));
      }
      stores.pipelines.set({ items, status: "ready", error: null, scopeId: projectId });
      if (!silent && items.length > 0) {
        const sel = stores.selection.get();
        if (sel.projectId === projectId && sel.pipelineId == null) {
          stores.selection.patch({
            pipelineId: items[0].id,
            jobId: null,
            pipelineGen: sel.pipelineGen + 1,
            jobGen: sel.jobGen + 1,
          });
          // Do not steal focus from projects sidebar (or other panes).
          stores.chrome.patch({
            board: { pipelineIndex: 0, stageIndex: 0, jobIndex: 0 },
          });
        }
      }
      {
        const sel = stores.selection.get();
        const board = stores.chrome.get().board;
        if (sel.pipelineId != null) {
          const idx = items.findIndex((p) => p.id === sel.pipelineId);
          if (idx >= 0 && idx !== board.pipelineIndex) {
            stores.chrome.patch({
              board: { ...board, pipelineIndex: idx },
            });
          }
        }
      }
      if (items[0]) {
        const st = items[0].status;
        const at = items[0].updatedAt ?? items[0].createdAt;
        stores.projects.set((prevP) => ({
          ...prevP,
          items: prevP.items.map((p) =>
            p.id === projectId
              ? { ...p, pulseStatus: st, lastPipelineAt: at ?? p.lastPipelineAt }
              : p,
          ),
        }));
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      if (stores.selection.get().projectGen !== gen) return;
      if (silent) {
        stores.queueMeta.patch({
          lastError: e instanceof Error ? e.message : String(e),
        });
        if (stores.pipelines.get().status === "stale") {
          stores.pipelines.patch({ status: "ready" });
        }
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      stores.pipelines.patch({
        status: prev.items.length && prev.scopeId === projectId ? "ready" : "error",
        error: msg,
      });
      throw e;
    }
  };

  const loadJobs: JobHandler = async (req) => {
    const projectId = req.projectId!;
    const pipelineId = req.pipelineId!;
    const gen = req.gen ?? stores.selection.get().pipelineGen;
    const silent = isSilent(req);
    const prev = stores.jobs.get();
    if (!silent) {
      const same = prev.scopeId === pipelineId && prev.items.length > 0;
      if (!same) {
        stores.jobs.set({
          items: [],
          stages: [],
          status: "loading",
          error: null,
          scopeId: pipelineId,
        });
      } else {
        stores.jobs.patch({ status: "stale", error: null });
      }
    }
    try {
      const [rawJobs, rawBridges] = await Promise.all([
        client.listJobs(projectId, pipelineId, req.signal),
        client.listBridges(projectId, pipelineId, req.signal).catch(() => [] as Record<string, unknown>[]),
      ]);
      if (stores.selection.get().pipelineGen !== gen) return;
      const jobItems = rawJobs.map(mapJob);
      const bridgeItems = rawBridges.map(mapBridge);
      const items = [...jobItems, ...bridgeItems];
      const stages = groupJobsByStage(items);
      stores.jobs.set({ items, stages, status: "ready", error: null, scopeId: pipelineId });
      const failed = firstFailedJobName(jobItems);
      if (failed) {
        stores.pipelines.set((prevP) => ({
          ...prevP,
          items: prevP.items.map((p) => (p.id === pipelineId ? { ...p, failedJobName: failed } : p)),
        }));
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      if (stores.selection.get().pipelineGen !== gen) return;
      if (silent) {
        stores.queueMeta.patch({
          lastError: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      stores.jobs.patch({
        status: prev.items.length && prev.scopeId === pipelineId ? "ready" : "error",
        error: msg,
      });
      throw e;
    }
  };

  const loadTrace: JobHandler = async (req) => {
    const projectId = req.projectId!;
    const jobId = req.jobId!;
    const gen = req.gen ?? stores.selection.get().jobGen;
    const silent = isSilent(req);
    const prev = stores.trace.get();
    if (!silent) {
      if (prev.jobId === jobId && prev.text) {
        stores.trace.patch({ status: "stale", error: null });
      } else {
        stores.trace.set({
          jobId,
          text: "",
          status: "loading",
          error: null,
        });
      }
    }
    try {
      const text = await client.jobTrace(projectId, jobId, req.signal);
      if (stores.selection.get().jobGen !== gen) return;
      stores.trace.set({
        jobId,
        text: tailLines(sanitizeTrace(text), 2000),
        status: "ready",
        error: null,
      });
      if (!silent) {
        parkLogOnFirstError(stores);
      } else if (stores.chrome.get().logFollow) {
        stores.chrome.patch({ logScrollFromBottom: 0 });
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      if (stores.selection.get().jobGen !== gen) return;
      if (silent) {
        stores.queueMeta.patch({
          lastError: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      stores.trace.patch({ status: "error", error: msg });
      throw e;
    }
  };

  const loadPulse: JobHandler = async (req) => {
    const projectId = req.projectId!;
    try {
      const latest = await client.latestPipeline(projectId, req.signal);
      if (!latest) return;
      const status = String(latest.status ?? "");
      const at =
        latest.updated_at != null
          ? String(latest.updated_at)
          : latest.created_at != null
            ? String(latest.created_at)
            : undefined;
      stores.projects.set((prevP) => ({
        ...prevP,
        items: prevP.items.map((p) =>
          p.id === projectId
            ? {
                ...p,
                pulseStatus: status,
                lastPipelineAt: at ?? p.lastPipelineAt,
              }
            : p,
        ),
      }));
    } catch {
      /* ignore */
    }
  };

  const refreshVisible: JobHandler = async (req) => {
    const sel = stores.selection.get();
    const silentReq = { ...req, silent: true, band: "poll" as const };
    if (sel.projectId != null) {
      await loadPipelines({
        ...silentReq,
        kind: "LoadPipelines",
        key: `poll:pipelines:${sel.projectId}`,
        projectId: sel.projectId,
        gen: sel.projectGen,
      });
    }
    if (sel.projectId != null && sel.pipelineId != null) {
      await loadJobs({
        ...silentReq,
        kind: "LoadJobs",
        key: `poll:jobs:${sel.pipelineId}`,
        projectId: sel.projectId,
        pipelineId: sel.pipelineId,
        gen: sel.pipelineGen,
      });
    }
    if (stores.chrome.get().logOpen && sel.projectId != null && sel.jobId != null) {
      const job = stores.jobs.get().items.find((j) => j.id === sel.jobId);
      if (job && isActiveStatus(job.status) && !job.isBridge) {
        await loadTrace({
          ...silentReq,
          kind: "LoadTrace",
          key: `poll:trace:${sel.jobId}`,
          projectId: sel.projectId,
          jobId: sel.jobId,
          gen: sel.jobGen,
        });
      }
    }
  };

  const savePrefsHandler: JobHandler = async () => {
    const p = stores.prefs.get();
    const prefs: Prefs = {
      pins: p.pins,
      recentProjects: p.recentProjects,
      projectScope: p.projectScope,
      recentMode: p.recentMode,
      pollIntervalMs: p.pollIntervalMs,
      live: p.live,
      sidebarVisible: p.sidebarVisible,
      gitlabHost: p.gitlabHost ?? null,
      logging: p.logging,
    };
    await savePrefs(prefs);
  };

  return {
    LoadProjects: loadProjects,
    LoadPipelines: loadPipelines,
    LoadJobs: loadJobs,
    LoadTrace: loadTrace,
    LoadPulse: loadPulse,
    RefreshVisible: refreshVisible,
    SavePrefs: savePrefsHandler,
  };
}

export type { JobRequest };
