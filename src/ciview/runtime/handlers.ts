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
} from "../gitlab/map.ts";
import { isActiveStatus } from "../gitlab/types.ts";
import type { RootStores } from "../state/root.ts";
import { parkLogOnFirstError } from "../util/logNav.ts";
import { sanitizeTrace, tailLines } from "../util/sanitizeTrace.ts";
import type { JobHandler } from "./queue.ts";
import type { JobRequest } from "./jobs.ts";

function isSilent(req: JobRequest): boolean {
  return req.silent === true || req.band === "poll";
}

export type EnqueueFn = (req: JobRequest) => void | Promise<void>;

export function createHandlers(
  client: GitLabClient,
  stores: RootStores,
  enqueue: EnqueueFn = () => {},
): Record<string, JobHandler> {
  const loadProjects: JobHandler = async (req) => {
    const silent = isSilent(req);
    if (!silent) {
      stores.projects.patch({ status: "loading", error: null });
    }
    try {
      const raw = await client.listProjects(req.signal);
      const pins = new Set(stores.prefs.get().pins);
      const items = raw.map((r) => mapProject(r, pins.has(String(r.path_with_namespace))));
      items.sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || a.pathWithNamespace.localeCompare(b.pathWithNamespace),
      );
      stores.projects.set({ items, status: "ready", error: null, scopeId: null });

      // FR-02: pulse for pinned + recent + top of list via idle LoadPulse jobs
      const recent = new Set(stores.prefs.get().recentProjects);
      const pulseIds = items
        .filter((p) => p.pinned || recent.has(p.pathWithNamespace))
        .slice(0, 20)
        .map((p) => p.id);
      for (const p of items.slice(0, 8)) {
        if (!pulseIds.includes(p.id)) pulseIds.push(p.id);
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
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      if (silent) {
        stores.queueMeta.patch({
          lastError: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      stores.projects.patch({ status: "error", error: msg });
      throw e;
    }
  };

  const loadPipelines: JobHandler = async (req) => {
    const projectId = req.projectId!;
    const gen = req.gen ?? stores.selection.get().projectGen;
    const silent = isSilent(req);
    if (!silent) {
      stores.pipelines.set({
        items: [],
        status: "loading",
        error: null,
        scopeId: projectId,
      });
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
      // User open only: auto-select newest when nothing selected yet.
      // Silent poll (FR-08b) must NOT steal focus to a brand-new pipeline.
      if (!silent && items.length > 0) {
        const sel = stores.selection.get();
        if (sel.projectId === projectId && sel.pipelineId == null) {
          stores.selection.patch({
            pipelineId: items[0].id,
            jobId: null,
            pipelineGen: sel.pipelineGen + 1,
            jobGen: sel.jobGen + 1,
          });
          stores.chrome.patch({
            board: { pipelineIndex: 0, stageIndex: 0, jobIndex: 0 },
            focusedPane: "stage_board",
          });
        }
      }
      // Keep strip cursor on the selected pipeline when list order shifts
      // (e.g. a newer pipeline appears at the top during silent poll).
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
      // Update sidebar pulse for this project from newest pipeline
      if (items[0]) {
        const st = items[0].status;
        stores.projects.set((prev) => ({
          ...prev,
          items: prev.items.map((p) => (p.id === projectId ? { ...p, pulseStatus: st } : p)),
        }));
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      if (stores.selection.get().projectGen !== gen) return;
      if (silent) {
        stores.queueMeta.patch({
          lastError: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      stores.pipelines.patch({ status: "error", error: msg });
      throw e;
    }
  };

  const loadJobs: JobHandler = async (req) => {
    const projectId = req.projectId!;
    const pipelineId = req.pipelineId!;
    const gen = req.gen ?? stores.selection.get().pipelineGen;
    const silent = isSilent(req);
    if (!silent) {
      stores.jobs.set({
        items: [],
        stages: [],
        status: "loading",
        error: null,
        scopeId: pipelineId,
      });
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
        stores.pipelines.set((prev) => ({
          ...prev,
          items: prev.items.map((p) => (p.id === pipelineId ? { ...p, failedJobName: failed } : p)),
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
      stores.jobs.patch({ status: "error", error: msg });
      throw e;
    }
  };

  const loadTrace: JobHandler = async (req) => {
    const projectId = req.projectId!;
    const jobId = req.jobId!;
    const gen = req.gen ?? stores.selection.get().jobGen;
    const silent = isSilent(req);
    if (!silent) {
      stores.trace.set({
        jobId,
        text: "",
        status: "loading",
        error: null,
      });
    }
    try {
      const text = await client.jobTrace(projectId, jobId, req.signal);
      if (stores.selection.get().jobGen !== gen) return;
      // preserve scroll if user scrolled up; follow resets to bottom only when follow on
      stores.trace.set({
        jobId,
        text: tailLines(sanitizeTrace(text), 2000),
        status: "ready",
        error: null,
      });
      // Smart park on first error (modal); silent poll only follows when follow on
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
      stores.projects.set((prev) => ({
        ...prev,
        items: prev.items.map((p) => (p.id === projectId ? { ...p, pulseStatus: status } : p)),
      }));
    } catch {
      /* ignore */
    }
  };

  const refreshVisible: JobHandler = async (req) => {
    const sel = stores.selection.get();
    const silentReq = { ...req, silent: true, band: "poll" as const };
    // FR-08b: always refresh pipeline strip when a project is open so new
    // pipelines appear without requiring active CI or manual `r`.
    if (sel.projectId != null) {
      await loadPipelines({
        ...silentReq,
        kind: "LoadPipelines",
        key: `poll:pipelines:${sel.projectId}`,
        projectId: sel.projectId,
        gen: sel.projectGen,
      });
    }
    // Jobs for the pipeline the user is already viewing (no auto-switch).
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
    // Trace only while log open and job still active (bandwidth).
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
      pollIntervalMs: p.pollIntervalMs,
      live: p.live,
      sidebarVisible: p.sidebarVisible,
      gitlabHost: p.gitlabHost ?? null,
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
