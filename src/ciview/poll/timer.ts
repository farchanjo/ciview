import type { RootStores } from "../state/root.ts";
import type { JobQueue } from "../runtime/queue.ts";
import { shouldEnqueuePoll } from "./policy.ts";
import { logger } from "../util/logger.ts";

/** How many live-poll ticks between silent membership list refreshes. */
const PROJECT_REFRESH_EVERY_TICKS = 10;

export function startPollTimer(stores: RootStores, queue: JobQueue): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let projectRefreshTicks = 0;

  const tick = () => {
    const prefs = stores.prefs.get();
    const sel = stores.selection.get();
    const pipelines = stores.pipelines.get().items;
    const jobs = stores.jobs.get().items;

    // Silent membership refresh so RECENT activity can bubble without open project.
    projectRefreshTicks += 1;
    if (prefs.live && projectRefreshTicks >= PROJECT_REFRESH_EVERY_TICKS) {
      projectRefreshTicks = 0;
      void queue.enqueue({
        kind: "LoadProjects",
        key: "poll:projects",
        band: "poll",
        silent: true,
      });
      logger.debug("poll_projects_enqueue");
    }

    if (
      !shouldEnqueuePoll({
        live: prefs.live,
        projectId: sel.projectId,
        pipelineStatuses: pipelines.map((p) => p.status),
        jobStatuses: jobs.map((j) => j.status),
      })
    ) {
      return;
    }

    void queue.enqueue({
      kind: "RefreshVisible",
      key: "poll:refresh",
      band: "poll",
    });
  };

  const restart = () => {
    if (timer) clearInterval(timer);
    const ms = stores.prefs.get().pollIntervalMs;
    timer = setInterval(tick, ms);
  };

  restart();
  const unsub = stores.prefs.subscribe(() => restart());

  return () => {
    unsub();
    if (timer) clearInterval(timer);
  };
}
