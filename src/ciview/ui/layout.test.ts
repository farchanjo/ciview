import { describe, expect, test } from "bun:test";
import type { Prefs } from "../config/prefs.ts";
import { createRootStores } from "../state/root.ts";
import {
  cycleJobLogMode,
  jumpLogError,
  parkLogOnFirstError,
  scrollLog,
  scrollLogFullPage,
} from "../util/logNav.ts";
import { logVisibleLines } from "../util/smartLog.ts";
import {
  effectiveSidebarVisible,
  fmtAge,
  fmtDur,
  formatJobBoardLine,
  jobDisplayDuration,
} from "./panes/PipelineGraph.tsx";

const basePrefs: Prefs = {
  pins: [],
  recentProjects: [],
  projectScope: "smart",
  pollIntervalMs: 3000,
  live: true,
  sidebarVisible: true,
  gitlabHost: null,
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

describe("formatJobBoardLine (FR-32 duration reserved)", () => {
  test("keeps duration when name is long", () => {
    const line = formatJobBoardLine(
      {
        name: "build_sflink_image",
        status: "success",
        allowFailure: false,
        duration: 47,
      },
      20,
    );
    expect(line.endsWith(" 47s")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(20);
    expect(line.startsWith("✓ ")).toBe(true);
  });

  test("short name keeps full name and duration", () => {
    const line = formatJobBoardLine(
      {
        name: "detect_changes",
        status: "success",
        allowFailure: false,
        duration: 6,
      },
      22,
    );
    expect(line).toBe("✓ detect_changes 6s");
  });

  test("allow_failure marker stays before duration", () => {
    const line = formatJobBoardLine(
      {
        name: "lint_optional_very_long_name",
        status: "failed",
        allowFailure: true,
        duration: 12,
      },
      18,
    );
    expect(line).toMatch(/! 12s$/);
    expect(line.length).toBeLessThanOrEqual(18);
  });

  test("no duration omits time suffix", () => {
    const line = formatJobBoardLine(
      {
        name: "pending_job",
        status: "pending",
        allowFailure: false,
      },
      20,
    );
    expect(line).toBe("● pending_job");
  });

  test("running job uses startedAt for live elapsed", () => {
    const now = Date.parse("2026-07-14T12:00:30Z");
    const line = formatJobBoardLine(
      {
        name: "build_sflink_image",
        status: "running",
        allowFailure: false,
        startedAt: "2026-07-14T12:00:00Z",
      },
      22,
      now,
    );
    expect(line.endsWith(" 30s")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(22);
  });
});

describe("jobDisplayDuration", () => {
  test("prefers finished duration over startedAt", () => {
    expect(
      jobDisplayDuration({
        duration: 42,
        startedAt: "2026-07-14T12:00:00Z",
        status: "success",
      }),
    ).toBe(42);
  });

  test("computes live elapsed for active jobs", () => {
    const now = Date.parse("2026-07-14T12:01:00Z");
    expect(
      jobDisplayDuration(
        {
          startedAt: "2026-07-14T12:00:00Z",
          status: "running",
        },
        now,
      ),
    ).toBe(60);
  });

  test("no elapsed for finished jobs without duration", () => {
    expect(
      jobDisplayDuration({
        startedAt: "2026-07-14T12:00:00Z",
        status: "success",
      }),
    ).toBeUndefined();
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
    const lines = Array.from({ length: 80 }, (_, i) => `L${i}`).join("\n");
    stores.chrome.patch({
      logOpen: true,
      logFollow: true,
      logScrollFromBottom: 0,
      logMode: "all",
      termHeight: 40,
    });
    stores.trace.set({ jobId: 1, text: lines, status: "ready", error: null });

    scrollLog(stores, -3);
    const ch = stores.chrome.get();
    expect(ch.logScrollFromBottom).toBe(3);
    expect(ch.logFollow).toBe(false);
  });

  test("scroll down to bottom re-enables follow", () => {
    const stores = createRootStores(basePrefs);
    const lines = Array.from({ length: 80 }, (_, i) => `L${i}`).join("\n");
    stores.chrome.patch({
      logOpen: true,
      logFollow: false,
      logScrollFromBottom: 5,
      logMode: "all",
      termHeight: 40,
    });
    stores.trace.set({ jobId: 1, text: lines, status: "ready", error: null });

    scrollLog(stores, 5);
    expect(stores.chrome.get().logScrollFromBottom).toBe(0);
    expect(stores.chrome.get().logFollow).toBe(true);
  });

  test("clamps to max from bottom", () => {
    const stores = createRootStores(basePrefs);
    const visible = logVisibleLines(40);
    const n = visible + 4;
    const lines = Array.from({ length: n }, (_, i) => `L${i}`).join("\n");
    stores.chrome.patch({
      logOpen: true,
      logFollow: true,
      logScrollFromBottom: 0,
      logMode: "all",
      termHeight: 40,
    });
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

describe("smart log nav", () => {
  const failedTrace = [
    "Downloading stuff",
    "ok so far",
    "Error: first boom",
    "stack a",
    "more noise",
    "Error: second boom",
    "exit code 1",
  ].join("\n");

  test("parkLogOnFirstError lands on first failure", () => {
    const stores = createRootStores(basePrefs);
    stores.chrome.patch({
      logOpen: true,
      logMode: "smart",
      logFollow: true,
      termHeight: 40,
    });
    stores.trace.set({ jobId: 1, text: failedTrace, status: "ready", error: null });
    parkLogOnFirstError(stores);
    const ch = stores.chrome.get();
    expect(ch.logFollow).toBe(false);
    expect(ch.logErrorCursor).toBe(0);
  });

  test("jumpLogError cycles n/N", () => {
    const stores = createRootStores(basePrefs);
    stores.chrome.patch({
      logOpen: true,
      logMode: "all",
      logErrorCursor: 0,
      termHeight: 40,
    });
    stores.trace.set({ jobId: 1, text: failedTrace, status: "ready", error: null });
    jumpLogError(stores, 1);
    expect(stores.chrome.get().logErrorCursor).toBe(1);
    // advance until wrap
    const seen = new Set<number>([1]);
    for (let i = 0; i < 10; i++) {
      jumpLogError(stores, 1);
      seen.add(stores.chrome.get().logErrorCursor);
      if (stores.chrome.get().logErrorCursor === 0) break;
    }
    expect(stores.chrome.get().logErrorCursor).toBe(0);
    expect(seen.size).toBeGreaterThanOrEqual(2);
    jumpLogError(stores, -1);
    expect(stores.chrome.get().logErrorCursor).toBeGreaterThan(0);
  });

  test("cycleJobLogMode rotates modes", () => {
    const stores = createRootStores(basePrefs);
    stores.chrome.patch({ logOpen: true, logMode: "smart", termHeight: 40 });
    stores.trace.set({ jobId: 1, text: failedTrace, status: "ready", error: null });
    cycleJobLogMode(stores);
    expect(stores.chrome.get().logMode).toBe("errors");
    cycleJobLogMode(stores);
    expect(stores.chrome.get().logMode).toBe("all");
    cycleJobLogMode(stores);
    expect(stores.chrome.get().logMode).toBe("smart");
  });

  test("scrollLogFullPage moves by full viewport", () => {
    const stores = createRootStores(basePrefs);
    const lines = Array.from({ length: 200 }, (_, i) => `L${i}`).join("\n");
    stores.chrome.patch({
      logOpen: true,
      logMode: "all",
      logFollow: true,
      logScrollFromBottom: 0,
      termHeight: 40,
      termWidth: 120,
    });
    stores.trace.set({ jobId: 1, text: lines, status: "ready", error: null });
    scrollLogFullPage(stores, -1);
    expect(stores.chrome.get().logScrollFromBottom).toBeGreaterThan(5);
    expect(stores.chrome.get().logFollow).toBe(false);
    const mid = stores.chrome.get().logScrollFromBottom;
    scrollLogFullPage(stores, 1);
    expect(stores.chrome.get().logScrollFromBottom).toBeLessThan(mid);
  });
});
