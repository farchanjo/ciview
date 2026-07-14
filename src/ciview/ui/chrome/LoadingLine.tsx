/** Compact loading row for pane transitions (not used for silent poll). */
export function LoadingLine(props: { label?: string }) {
  return <text fg="#f5c518">⟳ {props.label ?? "loading…"}</text>;
}
