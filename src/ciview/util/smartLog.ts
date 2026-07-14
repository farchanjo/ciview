/**
 * Smart job-log analysis for terminal viewing.
 * Classifies lines, builds condensed views around failures, supports jump-to-error.
 */

import { budgetLogContentRows } from "./layoutBudget.ts";

export type LogLineKind = "error" | "warn" | "section" | "ok" | "info" | "noise";
export type LogViewMode = "all" | "smart" | "errors";

export interface ClassifiedLine {
  /** Original 0-based line index in the full trace. */
  index: number;
  /** Display text (ANSI stripped). */
  text: string;
  kind: LogLineKind;
}

export type ViewLine =
  | {
      type: "content";
      /** Index into the classified array / original line. */
      index: number;
      text: string;
      kind: LogLineKind;
    }
  | {
      type: "ellipsis";
      omitted: number;
      /** First original index of the omitted range (for stable keys). */
      from: number;
    };

export interface LogView {
  view: ViewLine[];
  /** Indices into `view` that are content lines classified as error. */
  errorViewIndices: number[];
  /** Original line indices of hard errors. */
  errorOrigIndices: number[];
  totalLines: number;
  errorCount: number;
  warnCount: number;
}

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)|\x1b./g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/** GitLab CI collapsible section markers and common CI headers. */
const SECTION_RE =
  /^(?:section_start:|section_end:|={3,}|-{3,}|\*{3,}|#{1,3}\s|▶|▼|⟪|⟫)/i;

const ERROR_RE =
  /(?:\berror\b|\bfatal\b|\bpanic\b|\bfailed\b|\bfailure\b|BUILD FAILED|Traceback \(most recent|Exception\b|npm ERR!|exit code [1-9]\d*|\bE\d{3,}\b|✗|✖|ERROR:|Error:|FATAL:|FAILED)/i;

const WARN_RE = /(?:\bwarn(?:ing)?\b|WARN(?:ING)?:|⚠|deprecated)/i;

const OK_RE = /(?:\bsuccess(?:ful)?\b|\bpassed\b|\bok\b|✓|✔|done\.)/i;

const NOISE_RE =
  /(?:^##\[|\bDownloading\b|\bResolving\b|\bFetching\b|\bcache (?:hit|miss)\b|\bGet:\d|\bHit:\d|\bFetched\b|\bUnpacking\b|\bSetting up\b|\bPreparing\b|\b\d{1,3}%\b|progress:|bytes received)/i;

export function classifyLine(raw: string): LogLineKind {
  const line = stripAnsi(raw).trimEnd();
  if (!line.trim()) return "noise";
  if (SECTION_RE.test(line.trimStart())) return "section";
  // Error before warn so "ERROR warning" still counts as error
  if (ERROR_RE.test(line)) return "error";
  if (WARN_RE.test(line)) return "warn";
  if (OK_RE.test(line)) return "ok";
  if (NOISE_RE.test(line)) return "noise";
  return "info";
}

export function classifyTrace(text: string): ClassifiedLine[] {
  const rawLines = (text || "").split("\n");
  return rawLines.map((textLine, index) => ({
    index,
    text: stripAnsi(textLine),
    kind: classifyLine(textLine),
  }));
}

/**
 * Build a navigable view for the given mode.
 * - all: every line
 * - smart: errors/warns + context, sections, last tail; collapse the rest
 * - errors: only error + warn lines
 */
export function buildLogView(
  text: string,
  mode: LogViewMode,
  context = 3,
  tailKeep = 8,
): LogView {
  const classified = classifyTrace(text);
  const totalLines = classified.length;
  const errorOrigIndices = classified.filter((l) => l.kind === "error").map((l) => l.index);
  const warnCount = classified.filter((l) => l.kind === "warn").length;
  const errorCount = errorOrigIndices.length;

  if (mode === "all" || classified.length === 0) {
    const view: ViewLine[] = classified.map((l) => ({
      type: "content" as const,
      index: l.index,
      text: l.text,
      kind: l.kind,
    }));
    const errorViewIndices = view
      .map((v, i) => (v.type === "content" && v.kind === "error" ? i : -1))
      .filter((i) => i >= 0);
    return {
      view,
      errorViewIndices,
      errorOrigIndices,
      totalLines,
      errorCount,
      warnCount,
    };
  }

  if (mode === "errors") {
    const hits = classified.filter((l) => l.kind === "error" || l.kind === "warn");
    const view: ViewLine[] = hits.map((l) => ({
      type: "content" as const,
      index: l.index,
      text: l.text,
      kind: l.kind,
    }));
    const errorViewIndices = view
      .map((v, i) => (v.type === "content" && v.kind === "error" ? i : -1))
      .filter((i) => i >= 0);
    return {
      view,
      errorViewIndices,
      errorOrigIndices,
      totalLines,
      errorCount,
      warnCount,
    };
  }

  // smart: keep interesting windows
  const keep = new Uint8Array(classified.length);
  for (let i = 0; i < classified.length; i++) {
    const k = classified[i]!.kind;
    if (k === "error" || k === "warn" || k === "section") keep[i] = 1;
  }
  // context around errors/warns
  for (let i = 0; i < classified.length; i++) {
    const k = classified[i]!.kind;
    if (k !== "error" && k !== "warn") continue;
    const from = Math.max(0, i - context);
    const to = Math.min(classified.length - 1, i + context);
    for (let j = from; j <= to; j++) keep[j] = 1;
  }
  // always keep last N lines (exit codes / final status)
  const tailStart = Math.max(0, classified.length - tailKeep);
  for (let i = tailStart; i < classified.length; i++) keep[i] = 1;

  const view: ViewLine[] = [];
  let i = 0;
  while (i < classified.length) {
    if (keep[i]) {
      const l = classified[i]!;
      view.push({ type: "content", index: l.index, text: l.text, kind: l.kind });
      i++;
      continue;
    }
    const from = i;
    while (i < classified.length && !keep[i]) i++;
    const omitted = i - from;
    if (omitted > 0) {
      view.push({ type: "ellipsis", omitted, from });
    }
  }

  const errorViewIndices = view
    .map((v, idx) => (v.type === "content" && v.kind === "error" ? idx : -1))
    .filter((idx) => idx >= 0);

  return {
    view,
    errorViewIndices,
    errorOrigIndices,
    totalLines,
    errorCount,
    warnCount,
  };
}

/** Color for a classified line kind (GitHub dark palette). */
export function kindColor(kind: LogLineKind): string {
  switch (kind) {
    case "error":
      return "#f85149";
    case "warn":
      return "#d29922";
    case "section":
      return "#58a6ff";
    case "ok":
      return "#3fb950";
    case "noise":
      return "#6e7681";
    default:
      return "#c9d1d9";
  }
}

/** Glyph prefix for scanability. */
export function kindGlyph(kind: LogLineKind): string {
  switch (kind) {
    case "error":
      return "✗";
    case "warn":
      return "⚠";
    case "section":
      return "▸";
    case "ok":
      return "✓";
    case "noise":
      return "·";
    default:
      return " ";
  }
}

export function cycleLogMode(mode: LogViewMode): LogViewMode {
  if (mode === "smart") return "errors";
  if (mode === "errors") return "all";
  return "smart";
}

/**
 * How many content rows the modal can show given terminal height.
 * Delegates to LayoutBudget so short/tall terminals stay consistent (FR-43).
 */
export function logVisibleLines(termHeight: number, termWidth = 120): number {
  return budgetLogContentRows(termWidth, termHeight);
}

/**
 * Scroll offset (from bottom) so that `targetViewIndex` sits near the top
 * of the viewport (with a small lead-in).
 */
export function scrollToViewIndex(
  viewLen: number,
  targetViewIndex: number,
  visible: number,
  leadIn = 2,
): number {
  if (viewLen <= visible) return 0;
  const start = Math.max(0, Math.min(viewLen - visible, targetViewIndex - leadIn));
  const end = start + visible;
  return Math.max(0, viewLen - end);
}

export const LOG_MODES: LogViewMode[] = ["smart", "errors", "all"];
