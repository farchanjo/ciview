/**
 * Pure adaptive geometry for the ciview TUI (feature 003 / FR-40…FR-45).
 * UI components must consume this budget — no ad-hoc terminal magic numbers.
 */

export type Density = "compact" | "normal" | "comfortable";

export interface ModalBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Rows available for log/help content (excluding modal chrome lines). */
  contentRows: number;
  maxLineCols: number;
  /** Title/meta/footer rows reserved inside the modal. */
  chromeRows: number;
}

export interface LayoutBudget {
  termWidth: number;
  termHeight: number;
  density: Density;
  statusRows: number;
  sidebarVisibleEffective: boolean;
  sidebarWidth: number;
  stripRows: number;
  stageColWidth: number;
  logModal: ModalBox;
  helpModal: ModalBox;
}

export interface LayoutBudgetInput {
  termWidth: number;
  termHeight: number;
  /** User pref for sidebar visibility. */
  sidebarPrefVisible: boolean;
  /** null = auto from width; true/false = force. */
  sidebarForce: boolean | null | undefined;
  /** Stage count for column width (0 ok). */
  stageCount: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function densityForHeight(termHeight: number): Density {
  const h = termHeight > 0 ? termHeight : 40;
  if (h < 20) return "compact";
  if (h < 35) return "normal";
  return "comfortable";
}

/**
 * Effective sidebar visibility (FR-12 / FR-42).
 * Force overrides; else collapse under 100 cols when not forced.
 */
export function effectiveSidebarVisible(
  prefVisible: boolean,
  force: boolean | null | undefined,
  termWidth: number,
): boolean {
  if (force === true) return true;
  if (force === false) return false;
  if (termWidth > 0 && termWidth < 100) return false;
  return prefVisible;
}

/** Sidebar column budget when visible. */
export function sidebarWidthFor(termWidth: number, visible: boolean): number {
  if (!visible) return 0;
  const w = termWidth > 0 ? termWidth : 120;
  // Cap at 30% of width, within [18, 32]
  const byPct = Math.floor(w * 0.28);
  if (w < 100) return clamp(byPct, 18, 24);
  if (w < 140) return clamp(byPct, 24, 28);
  return clamp(byPct, 28, 32);
}

export function stripRowsFor(density: Density, termHeight: number): number {
  // Slightly taller strip so operators can scan more pipeline history (j/k).
  if (density === "compact") return Math.min(3, Math.max(2, termHeight - 8));
  if (density === "normal") return termHeight < 28 ? 3 : 4;
  // comfortable
  if (termHeight < 40) return 5;
  if (termHeight < 50) return 6;
  return 8;
}

/**
 * Window start so `cursor` stays visible in a fixed-height strip list.
 * Pure: when total ≤ windowSize → 0; otherwise pin cursor in view (prefer
 * showing newer rows above when scrolling down into older pipelines).
 */
export function stripWindowStart(
  cursor: number,
  windowSize: number,
  total: number,
): number {
  if (total <= 0 || windowSize <= 0) return 0;
  if (total <= windowSize) return 0;
  const c = clamp(cursor, 0, total - 1);
  const maxStart = total - windowSize;
  // Keep cursor in the last slot when walking down (classic list follow).
  const start = c - windowSize + 1;
  return clamp(start, 0, maxStart);
}

export function stageColWidthFor(
  termWidth: number,
  stageCount: number,
  sidebarOn: boolean,
  sidebarWidth: number,
): number {
  const side = sidebarOn ? sidebarWidth : 0;
  const usable = Math.max(20, termWidth - side - 4);
  if (stageCount <= 0) return clamp(Math.floor(usable / 3), 10, 22);
  const cols = Math.min(stageCount, 8);
  return clamp(Math.floor(usable / cols), 10, 22);
}

function modalBox(
  termWidth: number,
  termHeight: number,
  opts: { widthFrac: number; heightFrac: number; chromeRows: number; minContent: number },
): ModalBox {
  const w = Math.max(20, termWidth);
  const h = Math.max(8, termHeight);
  const width = clamp(Math.floor(w * opts.widthFrac), Math.min(20, w), w);
  const height = clamp(Math.floor(h * opts.heightFrac), Math.min(8, h), h);
  const left = Math.max(0, Math.floor((w - width) / 2));
  const top = Math.max(0, Math.floor((h - height) / 2));
  const chromeRows = opts.chromeRows;
  const contentRows = Math.max(opts.minContent, height - chromeRows);
  const maxLineCols = Math.max(16, width - 4);
  return { left, top, width, height, contentRows, maxLineCols, chromeRows };
}

/**
 * Compute full layout budget. Pure: same inputs → same outputs (NFR-41).
 */
export function computeLayoutBudget(input: LayoutBudgetInput): LayoutBudget {
  const termWidth = input.termWidth > 0 ? input.termWidth : 120;
  const termHeight = input.termHeight > 0 ? input.termHeight : 40;
  const density = densityForHeight(termHeight);
  const statusRows = density === "compact" ? 1 : 2;
  const sidebarVisibleEffective = effectiveSidebarVisible(
    input.sidebarPrefVisible,
    input.sidebarForce,
    termWidth,
  );
  const sidebarWidth = sidebarWidthFor(termWidth, sidebarVisibleEffective);
  const stripRows = stripRowsFor(density, termHeight);
  const stageColWidth = stageColWidthFor(
    termWidth,
    input.stageCount,
    sidebarVisibleEffective,
    sidebarWidth,
  );

  // Log modal: almost full viewport; chrome = title border + meta + keys + footer
  const logChrome = density === "compact" ? 4 : 5;
  const logMinContent = density === "compact" ? 6 : 10;
  const logModal = modalBox(termWidth, termHeight, {
    widthFrac: termWidth < 80 ? 0.98 : 0.96,
    heightFrac: density === "compact" ? 0.88 : density === "normal" ? 0.9 : 0.92,
    chromeRows: logChrome,
    minContent: logMinContent,
  });

  const helpModal = modalBox(termWidth, termHeight, {
    widthFrac: 0.9,
    heightFrac: density === "compact" ? 0.8 : 0.85,
    chromeRows: 3,
    minContent: 8,
  });

  return {
    termWidth,
    termHeight,
    density,
    statusRows,
    sidebarVisibleEffective,
    sidebarWidth,
    stripRows,
    stageColWidth,
    logModal,
    helpModal,
  };
}

/** Page scroll step ≈ half the log viewport (min 5). */
export function logPageStep(budget: LayoutBudget): number {
  return Math.max(5, Math.floor(budget.logModal.contentRows / 2));
}

/** Convenience: content rows for log from terminal height alone. */
export function budgetLogContentRows(termWidth: number, termHeight: number): number {
  return computeLayoutBudget({
    termWidth,
    termHeight,
    sidebarPrefVisible: true,
    sidebarForce: null,
    stageCount: 0,
  }).logModal.contentRows;
}

/** Invariant checks for tests / debug. */
export function assertBudgetFits(b: LayoutBudget): string[] {
  const errs: string[] = [];
  if (b.statusRows + 2 > b.termHeight) errs.push("status+min body > height");
  if (b.sidebarVisibleEffective && b.sidebarWidth > b.termWidth) errs.push("sidebar > width");
  if (b.stageColWidth < 10) errs.push("stageColWidth < 10");
  if (b.logModal.contentRows < 6) errs.push("log contentRows < 6");
  if (b.logModal.height > b.termHeight) errs.push("log modal taller than term");
  if (b.logModal.width > b.termWidth) errs.push("log modal wider than term");
  if (b.helpModal.height > b.termHeight) errs.push("help taller than term");
  if (b.stripRows < 0) errs.push("stripRows negative");
  return errs;
}
