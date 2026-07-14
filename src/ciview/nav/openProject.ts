import { pushRecent } from "../projects/filter.ts";
import type { JobQueue } from "../runtime/queue.ts";
import type { RootStores } from "../state/root.ts";
import { projectViewFlat } from "../ui/panes/ProjectSidebar.tsx";

/** Open project under cursor (or explicit id). Updates recent only here. */
export function openProject(stores: RootStores, queue: JobQueue, projectId?: number): void {
  const flat = projectViewFlat(stores).flat;
  const id =
    projectId ??
    flat[stores.chrome.get().projectCursor]?.id ??
    null;
  if (id == null) return;

  const proj = stores.projects.get().items.find((p) => p.id === id);
  if (!proj) return;

  const sel = stores.selection.get();
  stores.selection.set({
    projectId: id,
    pipelineId: null,
    jobId: null,
    projectGen: sel.projectGen + 1,
    pipelineGen: sel.pipelineGen + 1,
    jobGen: sel.jobGen + 1,
  });

  const recent = pushRecent(stores.prefs.get().recentProjects, proj.pathWithNamespace);
  stores.prefs.patch({ recentProjects: recent });
  void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });

  stores.chrome.patch({
    focusedPane: "pipeline_strip",
    logOpen: false,
    board: { pipelineIndex: 0, stageIndex: 0, jobIndex: 0 },
    pipelineStack: [],
  });
}

/**
 * Enter on a job: real jobs open the log; bridges with a downstream pipeline
 * dive into the child pipeline (FR-13 stack). Bridges without downstream open
 * a stub log explaining there is no trace.
 */
export function openJobLog(stores: RootStores, queue: JobQueue, jobId: number): void {
  const sel = stores.selection.get();
  if (sel.projectId == null) return;

  const job = stores.jobs.get().items.find((j) => j.id === jobId);

  // FR-13: dive into child pipeline when bridge has downstream
  if (job?.isBridge && job.downstreamPipelineId != null) {
    openChildPipeline(stores, job.downstreamPipelineId);
    return;
  }

  stores.selection.patch({
    jobId,
    jobGen: sel.jobGen + 1,
  });
  stores.chrome.patch({
    logOpen: true,
    focusedPane: "job_log",
    logScrollFromBottom: 0,
    logFollow: true,
  });

  // Bridges without downstream — drawer message only
  if (job?.isBridge) {
    stores.trace.set({
      jobId,
      text: "",
      status: "ready",
      error: null,
    });
    return;
  }

  stores.trace.set({
    jobId,
    text: "",
    status: "loading",
    error: null,
  });
  void queue.enqueue({
    kind: "LoadTrace",
    key: `user:trace:${jobId}`,
    band: "user",
    projectId: sel.projectId,
    jobId,
    gen: sel.jobGen + 1,
    silent: false,
  });
}

/** Push parent pipeline and switch selection to child (effects load jobs). */
export function openChildPipeline(stores: RootStores, childPipelineId: number): void {
  const sel = stores.selection.get();
  if (sel.projectId == null) return;
  const parentId = sel.pipelineId;
  const stack = stores.chrome.get().pipelineStack;
  stores.chrome.patch({
    pipelineStack: parentId != null ? [...stack, parentId] : stack,
    logOpen: false,
    focusedPane: "stage_board",
    board: {
      ...stores.chrome.get().board,
      stageIndex: 0,
      jobIndex: 0,
    },
  });
  stores.selection.patch({
    pipelineId: childPipelineId,
    jobId: null,
    pipelineGen: sel.pipelineGen + 1,
    jobGen: sel.jobGen + 1,
  });
}

/** Pop child pipeline stack (FR-13). Returns true if a parent was restored. */
export function popChildPipeline(stores: RootStores): boolean {
  const stack = stores.chrome.get().pipelineStack;
  if (stack.length === 0) return false;
  const parentId = stack[stack.length - 1]!;
  const nextStack = stack.slice(0, -1);
  const sel = stores.selection.get();
  stores.chrome.patch({
    pipelineStack: nextStack,
    logOpen: false,
    focusedPane: "stage_board",
    board: {
      ...stores.chrome.get().board,
      stageIndex: 0,
      jobIndex: 0,
    },
  });
  stores.selection.patch({
    pipelineId: parentId,
    jobId: null,
    pipelineGen: sel.pipelineGen + 1,
    jobGen: sel.jobGen + 1,
  });
  return true;
}

export function closeJobLog(stores: RootStores): void {
  stores.chrome.patch({ logOpen: false, focusedPane: "stage_board" });
}
