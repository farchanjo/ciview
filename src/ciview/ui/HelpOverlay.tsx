import { bindingsByCategory, KEY_BINDINGS } from "./keys.ts";

export function HelpOverlay(props: { scroll: number }) {
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

  const maxVisible = 22;
  const start = Math.max(0, Math.min(props.scroll, Math.max(0, lines.length - maxVisible)));
  const visible = lines.slice(start, start + maxVisible);

  return (
    <box
      style={{
        position: "absolute",
        left: 4,
        top: 2,
        width: "90%",
        height: "85%",
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
        <text key={i} fg={line.startsWith("──") ? "#58a6ff" : line.startsWith("ciview") ? "#f5c518" : "#c9d1d9"}>
          {line || " "}
        </text>
      ))}
      <text fg="#8b949e">
        {KEY_BINDINGS.length} bindings · lines {start + 1}-{start + visible.length}/{lines.length}
      </text>
    </box>
  );
}
