import type { RootStores } from "../state/root.ts";
import type { JobQueue } from "../runtime/queue.ts";
import { shouldEnqueuePoll } from "./policy.ts";

export function startPollTimer(stores: RootStores, queue: JobQueue): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    const prefs = stores.prefs.get();
    const sel = stores.selection.get();
    const pipelines = stores.pipelines.get().items;
    const jobs = stores.jobs.get().items;

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
