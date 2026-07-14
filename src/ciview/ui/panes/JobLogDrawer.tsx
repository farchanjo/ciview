import type { RootStores } from "../../state/root.ts";
import { statusColor, statusGlyph } from "../../util/statusGlyph.ts";
import { LoadingLine } from "../chrome/LoadingLine.tsx";
import { useStore } from "../hooks/useStore.ts";

const VISIBLE_LINES = 22;

export function JobLogDrawer(props: { stores: RootStores }) {
  const chrome = useStore(props.stores.chrome);
  const trace = useStore(props.stores.trace);
  const jobs = useStore(props.stores.jobs);
  const sel = useStore(props.stores.selection);

  if (!chrome.logOpen) return null;

  const job = jobs.items.find((j) => j.id === sel.jobId);
  const focused = chrome.focusedPane === "job_log";
  const borderColor = focused ? "#58a6ff" : "#30363d";
  const follow = chrome.logFollow && chrome.logScrollFromBottom === 0;
  const title = job
    ? ` Log · ${statusGlyph(job.status)} ${job.name} ${follow ? "· follow" : "· scrolled"} · j/k scroll · Esc `
    : " Log · Esc close ";

  const allLines = (trace.text || "").split("\n");
  const fromBottom = Math.max(0, chrome.logScrollFromBottom);
  const end = Math.max(0, allLines.length - fromBottom);
  const start = Math.max(0, end - VISIBLE_LINES);
  const visible = allLines.slice(start, end);

  return (
    <box
      title={title}
      style={{
        border: true,
        borderColor,
        flexDirection: "column",
        height: 16,
        flexShrink: 0,
        width: "100%",
      }}
    >
      {job ? (
        <text fg={statusColor(job.status)}>
          {job.status} · {job.stage}
          {job.duration != null ? ` · ${Math.round(job.duration)}s` : ""}
          {job.isBridge ? " · child pipeline (bridge)" : ""}
          {fromBottom > 0 ? ` · ↑${fromBottom}` : ""}
        </text>
      ) : (
        <text fg="#8b949e">no job selected</text>
      )}
      {trace.status === "loading" ? <LoadingLine label="loading job log…" /> : null}
      {trace.error ? <text fg="#f85149">{trace.error}</text> : null}
      {job?.isBridge ? (
        <text fg="#8b949e">
          Bridge has no job trace — open downstream pipeline in browser (o) or select a real job
        </text>
      ) : null}
      {trace.status !== "loading" &&
        !job?.isBridge &&
        visible.map((line, i) => (
          <text key={`${start + i}`} fg="#c9d1d9">
            {line.slice(0, Math.max(40, chrome.termWidth - 4)) || " "}
          </text>
        ))}
    </box>
  );
}

/**
 * Scroll log window (FR-06).
 * `delta > 0` = down toward end; `delta < 0` = up toward start.
 * Scrolling up pauses follow; returning to bottom re-enables follow.
 */
export function scrollLog(stores: RootStores, delta: number): void {
  const ch = stores.chrome.get();
  if (!ch.logOpen) return;
  const lines = (stores.trace.get().text || "").split("\n").length;
  const maxFromBottom = Math.max(0, lines - VISIBLE_LINES);
  // fromBottom: 0 = at end (follow); higher = scrolled up
  let next = ch.logScrollFromBottom;
  if (delta < 0) next = Math.min(maxFromBottom, next + Math.abs(delta));
  else next = Math.max(0, next - Math.abs(delta));
  stores.chrome.patch({
    logScrollFromBottom: next,
    logFollow: next === 0,
  });
}

export const LOG_VISIBLE_LINES = VISIBLE_LINES;
