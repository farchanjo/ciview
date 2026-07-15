import { describe, expect, test } from "bun:test";
import { DEFAULT_PREFS, type Prefs } from "../config/prefs.ts";
import { createRootStores } from "../state/root.ts";
import { openChildPipeline, openJobLog, openProject, popChildPipeline } from "./openProject.ts";
import type { JobQueue } from "../runtime/queue.ts";

const basePrefs: Prefs = {
  ...DEFAULT_PREFS,
  pins: [],
  recentProjects: [],
  logging: { ...DEFAULT_PREFS.logging },
};

function mockQueue(): JobQueue {
  const enqueued: unknown[] = [];
  return {
    enqueue: async (req) => {
      enqueued.push(req);
    },
    abortKey: () => {},
    clear: () => {},
    queue: {} as JobQueue["queue"],
    _enqueued: enqueued,
  } as JobQueue & { _enqueued: unknown[] };
}

describe("child pipeline stack (FR-13)", () => {
  test("openChildPipeline pushes parent and switches selection", () => {
    const stores = createRootStores(basePrefs);
    stores.selection.set({
      projectId: 1,
      pipelineId: 100,
      jobId: null,
      projectGen: 1,
      pipelineGen: 1,
      jobGen: 0,
    });

    openChildPipeline(stores, 200);

    expect(stores.chrome.get().pipelineStack).toEqual([100]);
    expect(stores.selection.get().pipelineId).toBe(200);
    expect(stores.selection.get().jobId).toBeNull();
    expect(stores.chrome.get().logOpen).toBe(false);
  });

  test("popChildPipeline restores parent", () => {
    const stores = createRootStores(basePrefs);
    stores.selection.set({
      projectId: 1,
      pipelineId: 100,
      jobId: null,
      projectGen: 1,
      pipelineGen: 1,
      jobGen: 0,
    });
    openChildPipeline(stores, 200);
    openChildPipeline(stores, 300);
    expect(stores.chrome.get().pipelineStack).toEqual([100, 200]);

    expect(popChildPipeline(stores)).toBe(true);
    expect(stores.selection.get().pipelineId).toBe(200);
    expect(stores.chrome.get().pipelineStack).toEqual([100]);

    expect(popChildPipeline(stores)).toBe(true);
    expect(stores.selection.get().pipelineId).toBe(100);
    expect(stores.chrome.get().pipelineStack).toEqual([]);

    expect(popChildPipeline(stores)).toBe(false);
  });

  test("openJobLog on bridge with downstream dives into child", () => {
    const stores = createRootStores(basePrefs);
    const queue = mockQueue();
    stores.selection.set({
      projectId: 1,
      pipelineId: 100,
      jobId: null,
      projectGen: 1,
      pipelineGen: 1,
      jobGen: 0,
    });
    stores.jobs.set({
      items: [
        {
          id: 9,
          pipelineId: 100,
          name: "↳ deploy-child",
          stage: "deploy",
          status: "success",
          allowFailure: false,
          isBridge: true,
          downstreamPipelineId: 777,
        },
      ],
      stages: [{ name: "deploy", jobIds: [9] }],
      status: "ready",
      error: null,
      scopeId: 100,
    });

    openJobLog(stores, queue, 9);

    expect(stores.selection.get().pipelineId).toBe(777);
    expect(stores.chrome.get().pipelineStack).toEqual([100]);
    expect(stores.chrome.get().logOpen).toBe(false);
  });

  test("openProject clears pipeline stack", () => {
    const stores = createRootStores(basePrefs);
    const queue = mockQueue();
    stores.projects.set({
      items: [
        {
          id: 1,
          pathWithNamespace: "g/p",
          name: "p",
          webUrl: "https://x",
          pinned: false,
        },
      ],
      status: "ready",
      error: null,
      scopeId: null,
    });
    stores.chrome.patch({ projectCursor: 0, pipelineStack: [1, 2, 3] });
    openProject(stores, queue, 1);
    expect(stores.chrome.get().pipelineStack).toEqual([]);
  });
});
