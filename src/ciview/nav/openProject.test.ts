import { describe, expect, test } from "bun:test";
import { DEFAULT_PREFS, type Prefs } from "../config/prefs.ts";
import { pushRecent } from "../projects/filter.ts";
import type { JobQueue } from "../runtime/queue.ts";
import { createRootStores } from "../state/root.ts";
import { openProject, previewProjectUnderCursor, selectProject } from "./openProject.ts";

const basePrefs: Prefs = {
  ...DEFAULT_PREFS,
  pins: [],
  recentProjects: ["infra/a", "infra/b", "infra/c"],
  recentMode: "opened",
  logging: { ...DEFAULT_PREFS.logging },
};

function mockQueue(): JobQueue & { prefsSaves: number } {
  const q = {
    prefsSaves: 0,
    enqueue: async (req: { kind: string }) => {
      if (req.kind === "SavePrefs") q.prefsSaves += 1;
    },
    abortKey: () => {},
    clear: () => {},
    queue: {} as JobQueue["queue"],
  };
  return q;
}

function seedProjects(stores: ReturnType<typeof createRootStores>) {
  stores.projects.set({
    items: [
      {
        id: 1,
        pathWithNamespace: "infra/a",
        name: "a",
        webUrl: "https://x/infra/a",
        pinned: false,
      },
      {
        id: 2,
        pathWithNamespace: "infra/b",
        name: "b",
        webUrl: "https://x/infra/b",
        pinned: false,
      },
    ],
    status: "ready",
    error: null,
    scopeId: null,
  });
}

describe("recent stability (FR-35/37)", () => {
  test("pushRecent only changes order when called", () => {
    const before = [...basePrefs.recentProjects];
    expect(before).toEqual(["infra/a", "infra/b", "infra/c"]);
    const afterOpen = pushRecent(before, "infra/c");
    expect(afterOpen[0]).toBe("infra/c");
    expect(afterOpen).toEqual(["infra/c", "infra/a", "infra/b"]);
  });

  test("project cursor does not require selection.projectId", () => {
    const stores = createRootStores(basePrefs);
    stores.chrome.patch({ projectCursor: 2 });
    expect(stores.selection.get().projectId).toBeNull();
    expect(stores.chrome.get().projectCursor).toBe(2);
  });

  test("openProject keeps focus on projects and records recent", () => {
    const stores = createRootStores(basePrefs);
    seedProjects(stores);
    const queue = mockQueue();
    stores.chrome.patch({ focusedPane: "projects", projectCursor: 0 });
    openProject(stores, queue, 1);
    expect(stores.selection.get().projectId).toBe(1);
    expect(stores.chrome.get().focusedPane).toBe("projects");
    expect(stores.prefs.get().recentProjects[0]).toBe("infra/a");
    expect(queue.prefsSaves).toBe(1);
  });

  test("j/k preview selects project without pushRecent", () => {
    const stores = createRootStores(basePrefs);
    seedProjects(stores);
    const queue = mockQueue();
    const recentBefore = [...stores.prefs.get().recentProjects];
    stores.chrome.patch({ focusedPane: "projects", projectCursor: 1 });
    previewProjectUnderCursor(stores, queue);
    expect(stores.selection.get().projectId).toBe(2);
    expect(stores.prefs.get().recentProjects).toEqual(recentBefore);
    expect(queue.prefsSaves).toBe(0);
    expect(stores.chrome.get().focusedPane).toBe("projects");
  });

  test("selectProject does not re-bump gen when already selected", () => {
    const stores = createRootStores(basePrefs);
    seedProjects(stores);
    const queue = mockQueue();
    selectProject(stores, queue, 1, { recordRecent: false });
    const gen = stores.selection.get().projectGen;
    selectProject(stores, queue, 1, { recordRecent: false });
    expect(stores.selection.get().projectGen).toBe(gen);
  });
});
