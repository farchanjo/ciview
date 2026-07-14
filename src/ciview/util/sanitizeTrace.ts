/** Strip / replace control characters unsafe for terminal display (keep \n \t). */
export function sanitizeTrace(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) {
      out += text[i];
      continue;
    }
    // strip ANSI CSI for safety in plain log pane? keep basic ANSI for colors
    if (code === 27) {
      // keep ESC sequences for color; copy through until letter terminator
      out += text[i];
      continue;
    }
    if (code < 32 || code === 127) {
      out += " ";
      continue;
    }
    out += text[i];
  }
  return out;
}

/** Keep last N lines for the store window. */
export function tailLines(text: string, maxLines: number): string {
  if (maxLines <= 0) return text;
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(-maxLines).join("\n");
}
