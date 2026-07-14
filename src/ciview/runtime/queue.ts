import PQueue from "p-queue";
import type { RootStores } from "../state/root.ts";
import type { JobRequest } from "./jobs.ts";
import { jobPriority } from "./jobs.ts";

export type JobHandler = (req: JobRequest) => Promise<void>;

export function createJobQueue(stores: RootStores, handlers: Record<string, JobHandler>) {
  const queue = new PQueue({ concurrency: 4 });
  const inflight = new Map<string, AbortController>();
  const scheduled = new Set<string>();

  function trackMeta() {
    stores.queueMeta.patch({
      pending: queue.pending + queue.size,
      inflight: [...inflight.keys()],
    });
  }

  queue.on("active", trackMeta);
  queue.on("next", trackMeta);
  queue.on("idle", trackMeta);

  async function enqueue(req: JobRequest): Promise<void> {
    if (scheduled.has(req.key) || inflight.has(req.key)) {
      return; // coalesce
    }
    scheduled.add(req.key);
    const priority = jobPriority(req);

    void queue.add(
      async () => {
        scheduled.delete(req.key);
        const ac = new AbortController();
        // merge external signal
        if (req.signal) {
          if (req.signal.aborted) {
            ac.abort();
          } else {
            req.signal.addEventListener("abort", () => ac.abort(), { once: true });
          }
        }
        inflight.set(req.key, ac);
        trackMeta();
        try {
          const handler = handlers[req.kind];
          if (!handler) throw new Error(`No handler for ${req.kind}`);
          await handler({ ...req, signal: ac.signal });
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return;
          const msg = e instanceof Error ? e.message : String(e);
          stores.queueMeta.patch({ lastError: msg });
        } finally {
          inflight.delete(req.key);
          trackMeta();
        }
      },
      { priority },
    );
  }

  function abortKey(prefix: string) {
    for (const [key, ac] of inflight) {
      if (key.startsWith(prefix)) ac.abort();
    }
  }

  function clear() {
    queue.clear();
    for (const ac of inflight.values()) ac.abort();
    inflight.clear();
    scheduled.clear();
    trackMeta();
  }

  return { enqueue, abortKey, clear, queue };
}

export type JobQueue = ReturnType<typeof createJobQueue>;
