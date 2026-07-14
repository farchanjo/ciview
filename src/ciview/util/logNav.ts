import type { RootStores } from "../state/root.ts";
import { computeLayoutBudget, logPageStep } from "./layoutBudget.ts";
import {
  buildLogView,
  cycleLogMode,
  logVisibleLines,
  scrollToViewIndex,
} from "./smartLog.ts";

function contentRows(stores: RootStores): number {
  const ch = stores.chrome.get();
  return logVisibleLines(ch.termHeight, ch.termWidth);
}

/**
 * Scroll log window (FR-06 / FR-50).
 * `delta > 0` = down toward end; `delta < 0` = up toward start.
 */
export function scrollLog(stores: RootStores, delta: number): void {
  const ch = stores.chrome.get();
  if (!ch.logOpen) return;
  const mode = ch.logMode ?? "smart";
  const visible = contentRows(stores);
  const viewLen = buildLogView(stores.trace.get().text || "", mode).view.length;
  const maxFromBottom = Math.max(0, viewLen - visible);
  let next = ch.logScrollFromBottom;
  if (delta < 0) next = Math.min(maxFromBottom, next + Math.abs(delta));
  else next = Math.max(0, next - Math.abs(delta));
  stores.chrome.patch({
    logScrollFromBottom: next,
    logFollow: next === 0,
  });
}

/** Page scroll using budget-derived step (≈ half viewport). */
export function scrollLogPage(stores: RootStores, dir: 1 | -1): void {
  const ch = stores.chrome.get();
  const budget = computeLayoutBudget({
    termWidth: ch.termWidth,
    termHeight: ch.termHeight,
    sidebarPrefVisible: ch.sidebarVisible,
    sidebarForce: ch.sidebarForce,
    stageCount: stores.jobs.get().stages.length,
  });
  scrollLog(stores, dir * logPageStep(budget));
}

/**
 * Full-page scroll for PageUp / PageDown — one viewport of contentRows.
 */
export function scrollLogFullPage(stores: RootStores, dir: 1 | -1): void {
  const ch = stores.chrome.get();
  if (!ch.logOpen) return;
  const budget = computeLayoutBudget({
    termWidth: ch.termWidth,
    termHeight: ch.termHeight,
    sidebarPrefVisible: ch.sidebarVisible,
    sidebarForce: ch.sidebarForce,
    stageCount: stores.jobs.get().stages.length,
  });
  const step = Math.max(1, budget.logModal.contentRows);
  scrollLog(stores, dir * step);
}

/** Jump to next/prev hard error in the current view. */
export function jumpLogError(stores: RootStores, dir: 1 | -1): void {
  const ch = stores.chrome.get();
  if (!ch.logOpen) return;
  const mode = ch.logMode ?? "smart";
  const logView = buildLogView(stores.trace.get().text || "", mode);
  if (logView.errorViewIndices.length === 0) return;

  const n = logView.errorViewIndices.length;
  let cursor = ch.logErrorCursor;
  if (cursor < 0 || cursor >= n) cursor = dir > 0 ? -1 : n;
  cursor = (cursor + dir + n) % n;
  const target = logView.errorViewIndices[cursor]!;
  const visible = contentRows(stores);
  stores.chrome.patch({
    logErrorCursor: cursor,
    logScrollFromBottom: scrollToViewIndex(logView.view.length, target, visible),
    logFollow: false,
  });
}

/** Cycle smart → errors → all → smart. */
export function cycleJobLogMode(stores: RootStores): void {
  const ch = stores.chrome.get();
  if (!ch.logOpen) return;
  const next = cycleLogMode(ch.logMode ?? "smart");
  const logView = buildLogView(stores.trace.get().text || "", next);
  const visible = contentRows(stores);
  const maxFromBottom = Math.max(0, logView.view.length - visible);
  let fromBottom = Math.min(ch.logScrollFromBottom, maxFromBottom);
  if (next !== "all" && logView.errorViewIndices.length > 0) {
    fromBottom = scrollToViewIndex(
      logView.view.length,
      logView.errorViewIndices[0]!,
      visible,
    );
  }
  stores.chrome.patch({
    logMode: next,
    logScrollFromBottom: fromBottom,
    logErrorCursor: 0,
    logFollow: fromBottom === 0,
  });
}

/** Jump viewport to top or end. */
export function jumpLogEdge(stores: RootStores, where: "top" | "end"): void {
  const ch = stores.chrome.get();
  if (!ch.logOpen) return;
  if (where === "end") {
    stores.chrome.patch({ logScrollFromBottom: 0, logFollow: true });
    return;
  }
  const mode = ch.logMode ?? "smart";
  const visible = contentRows(stores);
  const viewLen = buildLogView(stores.trace.get().text || "", mode).view.length;
  const maxFromBottom = Math.max(0, viewLen - visible);
  stores.chrome.patch({
    logScrollFromBottom: maxFromBottom,
    logFollow: false,
  });
}

/**
 * After a fresh (user) trace load: park on first error in smart/errors mode.
 */
export function parkLogOnFirstError(stores: RootStores): void {
  const ch = stores.chrome.get();
  if (!ch.logOpen) return;
  const mode = ch.logMode ?? "smart";
  if (mode === "all") {
    if (ch.logFollow) stores.chrome.patch({ logScrollFromBottom: 0 });
    return;
  }
  const logView = buildLogView(stores.trace.get().text || "", mode);
  if (logView.errorViewIndices.length === 0) {
    if (ch.logFollow) stores.chrome.patch({ logScrollFromBottom: 0 });
    return;
  }
  const visible = contentRows(stores);
  stores.chrome.patch({
    logErrorCursor: 0,
    logScrollFromBottom: scrollToViewIndex(
      logView.view.length,
      logView.errorViewIndices[0]!,
      visible,
    ),
    logFollow: false,
  });
}

/** Clamp scroll after resize (FR-45). */
export function clampLogScroll(stores: RootStores): void {
  const ch = stores.chrome.get();
  if (!ch.logOpen) return;
  const mode = ch.logMode ?? "smart";
  const visible = contentRows(stores);
  const viewLen = buildLogView(stores.trace.get().text || "", mode).view.length;
  const maxFromBottom = Math.max(0, viewLen - visible);
  if (ch.logScrollFromBottom > maxFromBottom) {
    stores.chrome.patch({
      logScrollFromBottom: maxFromBottom,
      logFollow: maxFromBottom === 0,
    });
  }
}
