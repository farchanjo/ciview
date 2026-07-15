import { useKeyboard, useRenderer } from "@opentui/react";
import { useEffect, useState } from "react";
import {
  confirmHostPicker,
  openHostPickerIfMulti,
} from "../auth/switchHost.ts";
import { listAuthenticatedHosts, type GlabHostEntry } from "../auth/resolve.ts";
import type { GitLabClient } from "../gitlab/client.ts";
import type { PaneId } from "../gitlab/types.ts";
import {
  closeJobLog,
  openJobLog,
  openProject,
  popChildPipeline,
  previewProjectUnderCursor,
} from "../nav/openProject.ts";
import { cycleRecentMode, cycleScope } from "../projects/filter.ts";
import type { JobQueue } from "../runtime/queue.ts";
import type { RootStores } from "../state/root.ts";
import { openUrl } from "../util/openUrl.ts";
import { StatusBar } from "./chrome/StatusBar.tsx";
import { HelpOverlay } from "./HelpOverlay.tsx";
import { HostPickerOverlay } from "./HostPickerOverlay.tsx";
import { useStore } from "./hooks/useStore.ts";
import {
  boardJobsInStage,
  boardStages,
  PipelineGraph,
} from "./panes/PipelineGraph.tsx";
import { JobLogDrawer } from "./panes/JobLogDrawer.tsx";
import {
  clampLogScroll,
  cycleJobLogMode,
  jumpLogEdge,
  jumpLogError,
  scrollLog,
  scrollLogFullPage,
  scrollLogPage,
} from "../util/logNav.ts";
import { computeLayoutBudget, effectiveSidebarVisible } from "../util/layoutBudget.ts";
import { ProjectSidebar, projectViewFlat } from "./panes/ProjectSidebar.tsx";

export interface AppProps {
  stores: RootStores;
  queue: JobQueue;
  client: GitLabClient;
  onQuit: () => void;
}

function filteredProjects(stores: RootStores) {
  return projectViewFlat(stores).flat;
}

function focusCycle(sidebarVisible: boolean, logOpen: boolean): PaneId[] {
  const panes: PaneId[] = [];
  if (sidebarVisible) panes.push("projects");
  panes.push("pipeline_strip", "stage_board");
  if (logOpen) panes.push("job_log");
  return panes;
}

export function App({ stores, queue, client, onQuit }: AppProps) {
  const renderer = useRenderer();
  const chrome = useStore(stores.chrome);
  useStore(stores.session);
  useStore(stores.prefs);
  useStore(stores.selection);
  useStore(stores.pipelines);
  useStore(stores.jobs);
  const [hostOptions, setHostOptions] = useState<GlabHostEntry[]>([]);

  // Refresh host list when picker opens (and once on mount)
  useEffect(() => {
    void listAuthenticatedHosts().then(setHostOptions);
  }, []);
  useEffect(() => {
    if (chrome.hostPickerOpen) {
      void listAuthenticatedHosts().then(setHostOptions);
    }
  }, [chrome.hostPickerOpen]);

  // FR-40/45: track terminal size; clamp log scroll on resize
  useEffect(() => {
    const sync = () => {
      const w =
        typeof renderer.width === "number" && renderer.width > 0
          ? renderer.width
          : (process.stdout.columns ?? 120);
      const h =
        typeof renderer.height === "number" && renderer.height > 0
          ? renderer.height
          : (process.stdout.rows ?? 40);
      const ch = stores.chrome.get();
      if (ch.termWidth !== w || ch.termHeight !== h) {
        stores.chrome.patch({ termWidth: w, termHeight: h });
        clampLogScroll(stores);
      }
    };
    sync();
    const onResize = () => sync();
    renderer.on("resize", onResize);
    return () => {
      renderer.off("resize", onResize);
    };
  }, [renderer, stores]);

  const layoutBudget = computeLayoutBudget({
    termWidth: chrome.termWidth,
    termHeight: chrome.termHeight,
    sidebarPrefVisible: chrome.sidebarVisible,
    sidebarForce: chrome.sidebarForce,
    stageCount: 0,
  });
  const showSidebar = layoutBudget.sidebarVisibleEffective;

  useKeyboard((key) => {
    const ch = stores.chrome.get();
    const sidebarShown = effectiveSidebarVisible(
      ch.sidebarVisible,
      ch.sidebarForce ?? null,
      ch.termWidth,
    );

    // FR-68/69: host picker modal captures keys while open
    if (ch.hostPickerOpen) {
      if (key.name === "q") {
        onQuit();
        return;
      }
      if (key.name === "escape") {
        if (!ch.hostPickerRequired) {
          stores.chrome.patch({ hostPickerOpen: false });
        }
        return;
      }
      if (key.name === "j" || key.name === "down") {
        const max = Math.max(0, hostOptions.length - 1);
        stores.chrome.patch({
          hostPickerCursor: Math.min(max, ch.hostPickerCursor + 1),
        });
        return;
      }
      if (key.name === "k" || key.name === "up") {
        stores.chrome.patch({
          hostPickerCursor: Math.max(0, ch.hostPickerCursor - 1),
        });
        return;
      }
      if (key.name === "return") {
        void confirmHostPicker(stores, client, queue);
        return;
      }
      // 1-9 jump + confirm
      if (key.raw && /^[1-9]$/.test(key.raw)) {
        const idx = Number(key.raw) - 1;
        if (idx >= 0 && idx < hostOptions.length) {
          stores.chrome.patch({ hostPickerCursor: idx });
          void confirmHostPicker(stores, client, queue);
        }
        return;
      }
      return;
    }

    if (ch.helpOpen) {
      if (key.name === "escape" || key.raw === "?" || key.name === "?") {
        stores.chrome.patch({ helpOpen: false });
        return;
      }
      if (key.name === "j" || key.name === "down") {
        stores.chrome.patch({ helpScroll: ch.helpScroll + 1 });
        return;
      }
      if (key.name === "k" || key.name === "up") {
        stores.chrome.patch({ helpScroll: Math.max(0, ch.helpScroll - 1) });
        return;
      }
      if (key.name === "q") return;
      return;
    }

    if (ch.filterActive) {
      if (key.name === "escape") {
        stores.chrome.patch({
          filterActive: false,
          filterDraft: "",
          projectFilter: ch.focusedPane === "projects" ? "" : ch.projectFilter,
          projectCursor: ch.focusedPane === "projects" ? 0 : ch.projectCursor,
        });
        return;
      }
      if (key.name === "return") {
        if (ch.focusedPane === "projects") {
          stores.chrome.patch({
            projectFilter: ch.filterDraft,
            filterActive: false,
            projectCursor: 0,
          });
        } else {
          stores.chrome.patch({ filterActive: false });
        }
        return;
      }
      if (key.name === "backspace") {
        const draft = ch.filterDraft.slice(0, -1);
        stores.chrome.patch({
          filterDraft: draft,
          ...(ch.focusedPane === "projects" ? { projectFilter: draft, projectCursor: 0 } : {}),
        });
        return;
      }
      if (key.raw && key.raw.length === 1 && !key.ctrl && !key.meta) {
        const draft = ch.filterDraft + key.raw;
        stores.chrome.patch({
          filterDraft: draft,
          ...(ch.focusedPane === "projects" ? { projectFilter: draft, projectCursor: 0 } : {}),
        });
      }
      return;
    }

    if (key.raw === "?" || key.name === "?") {
      stores.chrome.patch({ helpOpen: true, helpScroll: 0 });
      return;
    }

    if (key.name === "q") {
      // Graceful shutdown: stop poll/queue + restore terminal + exit
      // (Ctrl+C is handled by OpenTUI exitOnCtrlC → main onDestroy)
      onQuit();
      return;
    }

    // FR-69: H (shift+h) opens multi-host picker; no-op when ≤1 host
    if (key.name === "h" && key.shift && !key.ctrl && !key.meta) {
      void openHostPickerIfMulti(stores, false);
      return;
    }

    if (key.name === "s" && !key.shift) {
      const next = !sidebarShown;
      stores.chrome.patch({
        sidebarVisible: next,
        sidebarForce: next,
        focusedPane:
          !next && ch.focusedPane === "projects" ? "stage_board" : ch.focusedPane,
      });
      stores.prefs.patch({ sidebarVisible: next });
      void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
      return;
    }
    if (key.raw === "[") {
      stores.chrome.patch({
        sidebarVisible: false,
        sidebarForce: false,
        focusedPane: ch.focusedPane === "projects" ? "stage_board" : ch.focusedPane,
      });
      stores.prefs.patch({ sidebarVisible: false });
      void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
      return;
    }
    if (key.raw === "]") {
      stores.chrome.patch({
        sidebarVisible: true,
        sidebarForce: true,
      });
      stores.prefs.patch({ sidebarVisible: true });
      void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
      return;
    }

    if (key.name === "tab") {
      const panes = focusCycle(sidebarShown, ch.logOpen);
      if (panes.length === 0) return;
      let idx = panes.indexOf(ch.focusedPane);
      if (idx < 0) idx = 0;
      const next = key.shift
        ? panes[(idx - 1 + panes.length) % panes.length]
        : panes[(idx + 1) % panes.length];
      stores.chrome.patch({ focusedPane: next });
      return;
    }

    if (key.name === "1") {
      stores.chrome.patch({
        sidebarVisible: true,
        sidebarForce: true,
        focusedPane: "projects",
      });
      return;
    }
    if (key.name === "2") {
      stores.chrome.patch({ focusedPane: "pipeline_strip" });
      return;
    }
    if (key.name === "3") {
      stores.chrome.patch({ focusedPane: "stage_board" });
      return;
    }
    if (key.name === "4" && ch.logOpen) {
      stores.chrome.patch({ focusedPane: "job_log" });
      return;
    }

    // m: project scope
    if (key.name === "m" && !key.shift && !key.ctrl && ch.focusedPane === "projects") {
      const next = cycleScope(ch.projectScope);
      stores.chrome.patch({ projectScope: next, projectCursor: 0 });
      stores.prefs.patch({ projectScope: next });
      void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
      return;
    }

    // y: RECENT mode activity ↔ opened
    if (key.name === "y" && !key.shift && !key.ctrl && ch.focusedPane === "projects") {
      const next = cycleRecentMode(stores.prefs.get().recentMode);
      stores.prefs.patch({ recentMode: next });
      stores.chrome.patch({ projectCursor: 0 });
      void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
      return;
    }

    // x: expand RECENT 10 ↔ 20
    if (key.name === "x" && !key.shift && !key.ctrl && ch.focusedPane === "projects") {
      stores.chrome.patch({
        recentExpanded: !ch.recentExpanded,
        projectCursor: 0,
      });
      return;
    }

    if (key.raw === "/") {
      stores.chrome.patch({
        filterActive: true,
        filterDraft: ch.focusedPane === "projects" ? ch.projectFilter : "",
        focusedPane: "projects",
        sidebarVisible: true,
        sidebarForce: true,
      });
      return;
    }

    if (key.name === "r" && key.shift) {
      stores.prefs.patch({ live: !stores.prefs.get().live });
      void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
      return;
    }

    if (key.name === "r" && !key.shift) {
      refreshFocused(stores, queue);
      return;
    }

    if (key.name === "o") {
      void openFocusedUrl(stores);
      return;
    }

    if (key.name === "p" && !key.shift && ch.focusedPane === "projects") {
      togglePinUnderCursor(stores, queue);
      return;
    }

    // Job log modal — capture keys while open (overlay, not a layout pane)
    if (ch.logOpen) {
      if (key.name === "f") {
        const next = !ch.logFollow;
        stores.chrome.patch({
          logFollow: next,
          ...(next ? { logScrollFromBottom: 0 } : {}),
        });
        return;
      }
      if (key.name === "e" && !key.shift && !key.ctrl) {
        cycleJobLogMode(stores);
        return;
      }
      if (key.name === "n" && !key.shift) {
        jumpLogError(stores, 1);
        return;
      }
      if (key.name === "n" && key.shift) {
        jumpLogError(stores, -1);
        return;
      }
      if (key.name === "g" && !key.shift) {
        jumpLogEdge(stores, "top");
        return;
      }
      if (key.name === "g" && key.shift) {
        jumpLogEdge(stores, "end");
        return;
      }
      if (key.name === "j" || key.name === "down") {
        scrollLog(stores, 1);
        return;
      }
      if (key.name === "k" || key.name === "up") {
        scrollLog(stores, -1);
        return;
      }
      // PageUp / PageDown — full viewport (log view navigation)
      if (key.name === "pagedown" || key.name === "kppagedown") {
        scrollLogFullPage(stores, 1);
        return;
      }
      if (key.name === "pageup" || key.name === "kppageup") {
        scrollLogFullPage(stores, -1);
        return;
      }
      // half-page: Ctrl+d / Ctrl+u or space / b
      if (key.name === "d" && key.ctrl) {
        scrollLogPage(stores, 1);
        return;
      }
      if (key.name === "u" && key.ctrl) {
        scrollLogPage(stores, -1);
        return;
      }
      if (key.name === "space" || key.raw === " ") {
        scrollLogPage(stores, 1);
        return;
      }
      if (key.name === "b" && !key.ctrl) {
        scrollLogPage(stores, -1);
        return;
      }
      // Esc handled below; o/r/q still available
    }

    // Movement
    if (key.name === "j" || key.name === "down") {
      move(stores, queue, "down");
      return;
    }
    if (key.name === "k" || key.name === "up") {
      move(stores, queue, "up");
      return;
    }
    if (key.name === "h" || key.name === "left") {
      move(stores, queue, "left");
      return;
    }
    if (key.name === "l" || key.name === "right") {
      move(stores, queue, "right");
      return;
    }
    if (key.name === "g" && !key.shift) {
      jumpProjects(stores, queue, "top");
      return;
    }
    if (key.name === "g" && key.shift) {
      jumpProjects(stores, queue, "bottom");
      return;
    }

    if (key.name === "return") {
      onEnter(stores, queue);
      return;
    }

    if (key.name === "escape") {
      if (ch.logOpen) {
        closeJobLog(stores);
        return;
      }
      // FR-13: pop child pipeline stack before leaving graph
      if (popChildPipeline(stores)) {
        return;
      }
      if (ch.projectFilter && ch.focusedPane === "projects") {
        stores.chrome.patch({ projectFilter: "", projectCursor: 0 });
        return;
      }
      if (ch.focusedPane !== "projects") {
        stores.chrome.patch({
          focusedPane: "projects",
          sidebarVisible: true,
          sidebarForce: true,
        });
      }
      return;
    }
  });

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <StatusBar stores={stores} />
      {chrome.filterActive ? (
        <text fg="#f5c518">
          / projects: {chrome.filterDraft}_
        </text>
      ) : null}
      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%" }}>
        {showSidebar ? <ProjectSidebar stores={stores} /> : null}
        <box style={{ flexDirection: "column", flexGrow: 1, height: "100%" }}>
          <PipelineGraph stores={stores} />
        </box>
      </box>
      {/* Modal overlays — outside flex so they never break board layout */}
      <JobLogDrawer stores={stores} />
      {chrome.helpOpen ? (
        <HelpOverlay
          scroll={chrome.helpScroll}
          termWidth={chrome.termWidth}
          termHeight={chrome.termHeight}
        />
      ) : null}
      {chrome.hostPickerOpen ? (
        <HostPickerOverlay
          hosts={hostOptions}
          cursor={chrome.hostPickerCursor}
          required={chrome.hostPickerRequired}
          currentHost={stores.session.get().host}
          termWidth={chrome.termWidth}
          termHeight={chrome.termHeight}
        />
      ) : null}
    </box>
  );
}

/**
 * j/k/h/l navigation.
 * Projects: move cursor + select project (right pane updates like pipeline strip);
 * RECENT only changes on Enter (pushRecent), not on j/k.
 * Pipeline strip / board: navigate in place — Enter does not change focus panes.
 */
function move(stores: RootStores, queue: JobQueue, dir: "up" | "down" | "left" | "right") {
  const ch = stores.chrome.get();

  if (ch.focusedPane === "projects") {
    if (dir === "left" || dir === "right") return;
    const items = filteredProjects(stores);
    if (items.length === 0) return;
    const delta = dir === "down" ? 1 : -1;
    const next = Math.max(0, Math.min(items.length - 1, ch.projectCursor + delta));
    stores.chrome.patch({ projectCursor: next });
    previewProjectUnderCursor(stores, queue);
    return;
  }

  if (ch.focusedPane === "pipeline_strip") {
    const pipes = stores.pipelines.get().items;
    if (pipes.length === 0) return;
    let idx = ch.board.pipelineIndex;
    if (dir === "down" || dir === "right") idx = Math.min(pipes.length - 1, idx + 1);
    if (dir === "up" || dir === "left") idx = Math.max(0, idx - 1);
    // leaving a child dive when browsing the project strip again
    stores.chrome.patch({
      board: { ...ch.board, pipelineIndex: idx },
      pipelineStack: [],
    });
    const pipe = pipes[idx];
    if (pipe && pipe.id !== stores.selection.get().pipelineId) {
      const sel = stores.selection.get();
      stores.selection.patch({
        pipelineId: pipe.id,
        jobId: null,
        pipelineGen: sel.pipelineGen + 1,
        jobGen: sel.jobGen + 1,
      });
    }
    return;
  }

  if (ch.focusedPane === "stage_board") {
    const stages = boardStages(stores);
    if (stages.length === 0) return;
    let { stageIndex, jobIndex } = ch.board;

    if (dir === "left") {
      stageIndex = Math.max(0, stageIndex - 1);
      jobIndex = 0;
    } else if (dir === "right") {
      stageIndex = Math.min(stages.length - 1, stageIndex + 1);
      jobIndex = 0;
    } else if (dir === "down" || dir === "up") {
      const jobs = boardJobsInStage(stores, stageIndex);
      if (jobs.length === 0) return;
      if (dir === "down") jobIndex = Math.min(jobs.length - 1, jobIndex + 1);
      else jobIndex = Math.max(0, jobIndex - 1);
    }

    stores.chrome.patch({
      board: { ...ch.board, stageIndex, jobIndex },
    });
    // highlight job in selection for open, but do NOT load trace
    const jobs = boardJobsInStage(stores, stageIndex);
    const job = jobs[jobIndex];
    if (job) {
      const sel = stores.selection.get();
      if (sel.jobId !== job.id) {
        stores.selection.patch({ jobId: job.id });
      }
    }
    return;
  }

  if (ch.focusedPane === "job_log") {
    if (dir === "down") scrollLog(stores, 1);
    else if (dir === "up") scrollLog(stores, -1);
    // left/right: no-op in log
  }
}

function jumpProjects(stores: RootStores, queue: JobQueue, where: "top" | "bottom") {
  if (stores.chrome.get().focusedPane !== "projects") return;
  const items = filteredProjects(stores);
  if (items.length === 0) return;
  stores.chrome.patch({
    projectCursor: where === "top" ? 0 : items.length - 1,
  });
  previewProjectUnderCursor(stores, queue);
}

function onEnter(stores: RootStores, queue: JobQueue) {
  const ch = stores.chrome.get();
  if (ch.focusedPane === "projects") {
    // Confirm open + record RECENT; stay on projects (graph already follows j/k).
    openProject(stores, queue);
    return;
  }
  if (ch.focusedPane === "pipeline_strip") {
    // Pipeline already selected via j/k — do not jump focus to stage board.
    return;
  }
  if (ch.focusedPane === "stage_board") {
    const jobs = boardJobsInStage(stores, ch.board.stageIndex);
    const job = jobs[ch.board.jobIndex];
    if (job) openJobLog(stores, queue, job.id);
    return;
  }
}

function refreshFocused(stores: RootStores, queue: JobQueue) {
  const sel = stores.selection.get();
  const ch = stores.chrome.get();
  if (ch.focusedPane === "projects") {
    void queue.enqueue({
      kind: "LoadProjects",
      key: "user:projects",
      band: "user",
      silent: false,
    });
  } else if (sel.projectId != null && ch.focusedPane === "pipeline_strip") {
    void queue.enqueue({
      kind: "LoadPipelines",
      key: `user:pipelines:${sel.projectId}`,
      band: "user",
      projectId: sel.projectId,
      gen: sel.projectGen,
      silent: false,
    });
  } else if (sel.projectId != null && sel.pipelineId != null) {
    void queue.enqueue({
      kind: "LoadJobs",
      key: `user:jobs:${sel.pipelineId}`,
      band: "user",
      projectId: sel.projectId,
      pipelineId: sel.pipelineId,
      gen: sel.pipelineGen,
      silent: false,
    });
  } else if (ch.logOpen && sel.projectId != null && sel.jobId != null) {
    void queue.enqueue({
      kind: "LoadTrace",
      key: `user:trace:${sel.jobId}`,
      band: "user",
      projectId: sel.projectId,
      jobId: sel.jobId,
      gen: sel.jobGen,
      silent: false,
    });
  }
}

async function openFocusedUrl(stores: RootStores) {
  const sel = stores.selection.get();
  const ch = stores.chrome.get();
  if (ch.logOpen || ch.focusedPane === "stage_board" || ch.focusedPane === "job_log") {
    const job = stores.jobs.get().items.find((j) => j.id === sel.jobId);
    const pipe = stores.pipelines.get().items.find((p) => p.id === sel.pipelineId);
    const url = job?.webUrl ?? pipe?.webUrl;
    if (url) await openUrl(url);
    return;
  }
  if (ch.focusedPane === "projects") {
    const flat = filteredProjects(stores);
    const proj = flat[ch.projectCursor];
    if (proj?.webUrl) await openUrl(proj.webUrl);
    return;
  }
  const pipe = stores.pipelines.get().items.find((p) => p.id === sel.pipelineId);
  if (pipe?.webUrl) await openUrl(pipe.webUrl);
}

function togglePinUnderCursor(stores: RootStores, queue: JobQueue) {
  const flat = filteredProjects(stores);
  const proj = flat[stores.chrome.get().projectCursor];
  if (!proj) return;
  const pins = new Set(stores.prefs.get().pins);
  if (pins.has(proj.pathWithNamespace)) pins.delete(proj.pathWithNamespace);
  else pins.add(proj.pathWithNamespace);
  stores.prefs.patch({ pins: [...pins] });
  stores.projects.set((prev) => ({
    ...prev,
    items: prev.items.map((p) => ({
      ...p,
      pinned: pins.has(p.pathWithNamespace),
    })),
  }));
  void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
}
