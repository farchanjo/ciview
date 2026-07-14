import { describe, expect, test } from "bun:test";
import type { Prefs } from "../config/prefs.ts";
import { createRootStores } from "../state/root.ts";
import { scrollLog, LOG_VISIBLE_LINES } from "./panes/JobLogDrawer.tsx";
import { effectiveSidebarVisible, fmtAge, fmtDur } from "./panes/PipelineGraph.tsx";

const basePrefs: Prefs = {
  pins: [],
  recentProjects: [],
  projectScope: "smart",
  pollIntervalMs: 3000,
  live: true,
  sidebarVisible: true,
};

describe("fmtDur / fmtAge (FR-03/32)", () => {
  test("fmtDur formats seconds and minutes", () => {
    expect(fmtDur(12)).toBe("12s");
    expect(fmtDur(125)).toBe("2m05s");
    expect(fmtDur(undefined)).toBe("");
  });

  test("fmtAge returns relative age", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(fmtAge(fiveMinAgo)).toBe("5m");
    expect(fmtAge(undefined)).toBe("");
  });
});

describe("effectiveSidebarVisible (FR-12)", () => {
  test("collapses under 100 cols when not forced", () => {
    expect(effectiveSidebarVisible(true, null, 90)).toBe(false);
    expect(effectiveSidebarVisible(true, null, 120)).toBe(true);
  });

  test("force true/false overrides width", () => {
    expect(effectiveSidebarVisible(false, true, 80)).toBe(true);
    expect(effectiveSidebarVisible(true, false, 200)).toBe(false);
  });

  test("prefVisible respected when wide and force null", () => {
    expect(effectiveSidebarVisible(false, null, 140)).toBe(false);
  });
});

describe("scrollLog (FR-06)", () => {
  test("scroll up increases fromBottom and pauses follow", () => {
    const stores = createRootStores(basePrefs);
    const lines = Array.from({ length: 40 }, (_, i) => `L${i}`).join("\n");
    stores.chrome.patch({ logOpen: true, logFollow: true, logScrollFromBottom: 0 });
    stores.trace.set({ jobId: 1, text: lines, status: "ready", error: null });

    scrollLog(stores, -3);
    const ch = stores.chrome.get();
    expect(ch.logScrollFromBottom).toBe(3);
    expect(ch.logFollow).toBe(false);
  });

  test("scroll down to bottom re-enables follow", () => {
    const stores = createRootStores(basePrefs);
    const lines = Array.from({ length: 40 }, (_, i) => `L${i}`).join("\n");
    stores.chrome.patch({ logOpen: true, logFollow: false, logScrollFromBottom: 5 });
    stores.trace.set({ jobId: 1, text: lines, status: "ready", error: null });

    scrollLog(stores, 5);
    expect(stores.chrome.get().logScrollFromBottom).toBe(0);
    expect(stores.chrome.get().logFollow).toBe(true);
  });

  test("clamps to max from bottom", () => {
    const stores = createRootStores(basePrefs);
    const n = LOG_VISIBLE_LINES + 4;
    const lines = Array.from({ length: n }, (_, i) => `L${i}`).join("\n");
    stores.chrome.patch({ logOpen: true, logFollow: true, logScrollFromBottom: 0 });
    stores.trace.set({ jobId: 1, text: lines, status: "ready", error: null });

    scrollLog(stores, -100);
    expect(stores.chrome.get().logScrollFromBottom).toBe(4);
  });

  test("no-op when log closed", () => {
    const stores = createRootStores(basePrefs);
    stores.chrome.patch({ logOpen: false, logScrollFromBottom: 0 });
    scrollLog(stores, -2);
    expect(stores.chrome.get().logScrollFromBottom).toBe(0);
  });
});
