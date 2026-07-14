import type { GlabHostEntry } from "../auth/resolve.ts";
import { computeLayoutBudget } from "../util/layoutBudget.ts";

export function HostPickerOverlay(props: {
  hosts: GlabHostEntry[];
  cursor: number;
  required: boolean;
  currentHost?: string;
  termWidth?: number;
  termHeight?: number;
}) {
  const budget = computeLayoutBudget({
    termWidth: props.termWidth ?? 120,
    termHeight: props.termHeight ?? 40,
    sidebarPrefVisible: true,
    sidebarForce: null,
    stageCount: 0,
  });
  // Slightly smaller than help — list of hosts
  const modal = budget.helpModal;
  const maxVisible = Math.max(4, modal.contentRows - 4);
  const total = props.hosts.length;
  const cursor = Math.max(0, Math.min(total - 1, props.cursor));
  const start = Math.max(
    0,
    Math.min(cursor - Math.floor(maxVisible / 2), Math.max(0, total - maxVisible)),
  );
  const slice = props.hosts.slice(start, start + maxVisible);
  const maxCols = modal.maxLineCols;
  const currentKey = (props.currentHost ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  const footer = props.required
    ? "Enter:select  j/k:move  1-9:jump  q:quit  (Esc disabled until host chosen)"
    : "Enter:select  j/k:move  1-9:jump  Esc:cancel  H:reopen later";

  return (
    <box
      style={{
        position: "absolute",
        left: modal.left,
        top: modal.top,
        width: modal.width,
        height: modal.height,
        border: true,
        borderColor: "#f5c518",
        backgroundColor: "#0d1117",
        flexDirection: "column",
        padding: 1,
        zIndex: 120,
      }}
      title=" Choose GitLab host "
    >
      <text fg="#f5c518">{"glab authenticated instances".slice(0, maxCols)}</text>
      <text fg="#8b949e">
        {"Pick a host — saved for next launch (prefs.gitlabHost)".slice(0, maxCols)}
      </text>
      <text fg="#8b949e">{" "}</text>
      {slice.map((h, i) => {
        const abs = start + i;
        const selected = abs === cursor;
        const isCurrent =
          h.hostname === currentKey ||
          h.apiHost === currentKey ||
          currentKey.includes(h.hostname);
        const mark = selected ? "❯" : " ";
        const cur = isCurrent ? " (current)" : "";
        const user = h.user ? ` · ${h.user}` : "";
        const line = `${mark} ${abs + 1}. ${h.hostname}${user}${cur}`;
        return (
          <text key={h.hostname} fg={selected ? "#f5c518" : isCurrent ? "#58a6ff" : "#c9d1d9"}>
            {line.slice(0, maxCols)}
          </text>
        );
      })}
      <text fg="#8b949e">{" "}</text>
      <text fg="#8b949e">{footer.slice(0, maxCols)}</text>
    </box>
  );
}
