import type { RootStores } from "../../state/root.ts";
import { computeLayoutBudget } from "../../util/layoutBudget.ts";
import {
  buildLogView,
  kindColor,
  kindGlyph,
  type LogViewMode,
} from "../../util/smartLog.ts";
import { statusColor, statusGlyph } from "../../util/statusGlyph.ts";
import { LoadingLine } from "../chrome/LoadingLine.tsx";
import { useStore } from "../hooks/useStore.ts";

// Re-export nav helpers for existing imports.
export {
  cycleJobLogMode,
  jumpLogEdge,
  jumpLogError,
  parkLogOnFirstError,
  scrollLog,
} from "../../util/logNav.ts";

/**
 * Full-viewport job log modal with smart highlighting (FR-46…FR-51).
 * Absolute overlay — does not reflow the main board layout (FR-44).
 */
export function JobLogDrawer(props: { stores: RootStores }) {
  const chrome = useStore(props.stores.chrome);
  const trace = useStore(props.stores.trace);
  const jobs = useStore(props.stores.jobs);
  const sel = useStore(props.stores.selection);

  if (!chrome.logOpen) return null;

  const budget = computeLayoutBudget({
    termWidth: chrome.termWidth,
    termHeight: chrome.termHeight,
    sidebarPrefVisible: chrome.sidebarVisible,
    sidebarForce: chrome.sidebarForce,
    stageCount: jobs.stages.length,
  });
  const modal = budget.logModal;

  const job = jobs.items.find((j) => j.id === sel.jobId);
  const mode: LogViewMode = chrome.logMode ?? "smart";
  const visible = modal.contentRows;
  const maxCols = modal.maxLineCols;

  const logView = buildLogView(trace.text || "", mode);
  const allView = logView.view;
  const fromBottom = Math.max(0, chrome.logScrollFromBottom);
  const end = Math.max(0, allView.length - fromBottom);
  const start = Math.max(0, end - visible);
  const window = allView.slice(start, end);
  const follow = chrome.logFollow && fromBottom === 0;

  const errHit =
    logView.errorViewIndices.length > 0
      ? `${Math.min(chrome.logErrorCursor + 1, logView.errorViewIndices.length)}/${logView.errorCount}`
      : "0";

  const title = job
    ? ` Job log · ${statusGlyph(job.status)} ${job.name} · ${mode} · ✗${errHit} · ${budget.density} `
    : " Job log ";

  return (
    <box
      style={{
        position: "absolute",
        left: modal.left,
        top: modal.top,
        width: modal.width,
        height: modal.height,
        border: true,
        borderColor: "#58a6ff",
        backgroundColor: "#0d1117",
        flexDirection: "column",
        padding: 1,
        zIndex: 90,
      }}
      title={title}
    >
      {job ? (
        <text fg={statusColor(job.status)}>
          {job.status} · {job.stage}
          {job.duration != null ? ` · ${Math.round(job.duration)}s` : ""}
          {job.isBridge ? " · bridge" : ""}
          {` · ${logView.totalLines} lines`}
          {logView.errorCount ? ` · ${logView.errorCount} errors` : ""}
          {logView.warnCount ? ` · ${logView.warnCount} warns` : ""}
          {follow ? " · follow" : fromBottom > 0 ? ` · ↑${fromBottom}` : ""}
          {` · ${chrome.termWidth}×${chrome.termHeight}`}
        </text>
      ) : (
        <text fg="#8b949e">no job selected</text>
      )}
      <text fg="#6e7681">
        j/k · PgUp/PgDn · n/N error · e mode({mode}) · g/G · f · Space/b · Esc
      </text>

      {trace.status === "loading" ? <LoadingLine label="loading job log…" /> : null}
      {trace.error ? <text fg="#f85149">{trace.error}</text> : null}
      {job?.isBridge ? (
        <text fg="#8b949e">
          Bridge has no job trace — open downstream in browser (o) or select a real job
        </text>
      ) : null}

      {trace.status !== "loading" &&
        !job?.isBridge &&
        window.map((line, i) => {
          if (line.type === "ellipsis") {
            return (
              <text key={`e-${line.from}-${i}`} fg="#6e7681">
                {`  … ${line.omitted} lines omitted …`}
              </text>
            );
          }
          const glyph = kindGlyph(line.kind);
          const num = String(line.index + 1).padStart(4, " ");
          const body = (line.text || " ").slice(0, Math.max(12, maxCols - 8));
          const viewIdx = start + i;
          const isErrHit = logView.errorViewIndices[chrome.logErrorCursor] === viewIdx;
          return (
            <text
              key={`l-${line.index}`}
              fg={isErrHit ? "#ffffff" : kindColor(line.kind)}
              bg={isErrHit ? "#6e2126" : line.kind === "error" ? "#2d1215" : undefined}
            >
              {`${num} ${glyph} ${body}`}
            </text>
          );
        })}

      {trace.status !== "loading" && !job?.isBridge && allView.length === 0 ? (
        <text fg="#8b949e">(empty log)</text>
      ) : null}

      <text fg="#8b949e">
        {allView.length
          ? `rows ${start + 1}-${Math.min(end, allView.length)}/${allView.length} · ${mode} · ${visible}vis`
          : `mode ${mode}`}
      </text>
    </box>
  );
}

/** Fallback for older tests; prefer budget.logModal.contentRows. */
export const LOG_VISIBLE_LINES = 22;
