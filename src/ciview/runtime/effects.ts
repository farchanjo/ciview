import type { RootStores } from "../state/root.ts";
import type { JobQueue } from "./queue.ts";

/**
 * Selection-driven loads (feature 002):
 * - project open → pipelines
 * - pipeline change → jobs (board)
 * - job+logOpen → handled by openJobLog (not here), so cursor on board does not LoadTrace
 */
export function wireSelectionEffects(stores: RootStores, queue: JobQueue): () => void {
  let lastProject: number | null = null;
  let lastPipeline: number | null = null;

  return stores.selection.subscribe((sel) => {
    if (sel.projectId !== lastProject) {
      lastProject = sel.projectId;
      lastPipeline = null;
      if (sel.projectId != null) {
        queue.abortKey("user:pipelines:");
        queue.abortKey("user:jobs:");
        queue.abortKey("user:trace:");
        stores.pipelines.set({
          items: [],
          status: "loading",
          error: null,
          scopeId: sel.projectId,
        });
        stores.jobs.set({
          items: [],
          stages: [],
          status: "idle",
          error: null,
          scopeId: null,
        });
        stores.trace.set({ jobId: null, text: "", status: "idle", error: null });
        stores.chrome.patch({
          logOpen: false,
          board: { pipelineIndex: 0, stageIndex: 0, jobIndex: 0 },
        });
        void queue.enqueue({
          kind: "LoadPipelines",
          key: `user:pipelines:${sel.projectId}`,
          band: "user",
          projectId: sel.projectId,
          gen: sel.projectGen,
          silent: false,
        });
      }
    }

    if (sel.pipelineId !== lastPipeline) {
      lastPipeline = sel.pipelineId;
      if (sel.projectId != null && sel.pipelineId != null) {
        queue.abortKey("user:jobs:");
        queue.abortKey("user:trace:");
        stores.jobs.set({
          items: [],
          stages: [],
          status: "loading",
          error: null,
          scopeId: sel.pipelineId,
        });
        stores.trace.set({ jobId: null, text: "", status: "idle", error: null });
        stores.chrome.patch({
          logOpen: false,
          board: {
            ...stores.chrome.get().board,
            stageIndex: 0,
            jobIndex: 0,
          },
        });
        void queue.enqueue({
          kind: "LoadJobs",
          key: `user:jobs:${sel.pipelineId}`,
          band: "user",
          projectId: sel.projectId,
          pipelineId: sel.pipelineId,
          gen: sel.pipelineGen,
          silent: false,
        });
      }
    }
  });
}
