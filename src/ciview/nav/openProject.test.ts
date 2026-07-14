import { describe, expect, test } from "bun:test";
import { pushRecent } from "../projects/filter.ts";
import { createRootStores } from "../state/root.ts";
import type { Prefs } from "../config/prefs.ts";

const basePrefs: Prefs = {
  pins: [],
  recentProjects: ["infra/a", "infra/b", "infra/c"],
  projectScope: "smart",
  pollIntervalMs: 3000,
  live: true,
  sidebarVisible: true,
  gitlabHost: null,
};

describe("recent stability (FR-35/37)", () => {
  test("pushRecent only changes order when called", () => {
    const before = [...basePrefs.recentProjects];
    // simulate cursor moves: no pushRecent
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
});
