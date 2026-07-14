import { computeLayoutBudget } from "../util/layoutBudget.ts";
import { bindingsByCategory, KEY_BINDINGS } from "./keys.ts";

export function HelpOverlay(props: {
  scroll: number;
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
  const modal = budget.helpModal;

  const byCat = bindingsByCategory();
  const lines: string[] = ["ciview — keyboard shortcuts", ""];
  for (const [cat, bindings] of byCat) {
    lines.push(`── ${cat} ──`);
    for (const b of bindings) {
      lines.push(`  ${b.key.padEnd(12)} ${b.label}`);
    }
    lines.push("");
  }
  lines.push("?:close  Esc:close  j/k:scroll help");

  const maxVisible = modal.contentRows;
  const start = Math.max(0, Math.min(props.scroll, Math.max(0, lines.length - maxVisible)));
  const visible = lines.slice(start, start + maxVisible);
  const maxCols = modal.maxLineCols;

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
        zIndex: 100,
      }}
      title=" Help — shortcuts "
    >
      {visible.map((line, i) => (
        <text
          key={i}
          fg={
            line.startsWith("──")
              ? "#58a6ff"
              : line.startsWith("ciview")
                ? "#f5c518"
                : "#c9d1d9"
          }
        >
          {(line || " ").slice(0, maxCols)}
        </text>
      ))}
      <text fg="#8b949e">
        {KEY_BINDINGS.length} bindings · lines {start + 1}-{start + visible.length}/
        {lines.length} · {budget.density}
      </text>
    </box>
  );
}
