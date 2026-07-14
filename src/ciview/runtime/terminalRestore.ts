/**
 * Best-effort terminal restore so Ctrl+C / quit never leaves the parent shell
 * broken (raw mode, Kitty keyboard CSI-u noise, alt screen, hidden cursor).
 *
 * OpenTUI normally restores on full destroy; we still write these sequences
 * after destroy because early process.exit or partial teardown can skip native
 * cleanup (see FR-27).
 */
export function restoreTerminalTty(
  stdin: NodeJS.ReadStream = process.stdin,
  stdout: NodeJS.WriteStream = process.stdout,
): void {
  // Leave raw mode first so the shell gets cooked input again.
  try {
    if (stdin.isTTY && typeof stdin.setRawMode === "function") {
      stdin.setRawMode(false);
    }
  } catch {
    /* ignore */
  }
  try {
    stdin.pause();
  } catch {
    /* ignore */
  }

  if (!stdout.writable) return;

  // Order matters: disable input modes → leave alt screen → show cursor → reset attrs.
  const seq = [
    "\x1b[?1000l", // X10 mouse
    "\x1b[?1002l", // cell motion mouse
    "\x1b[?1003l", // all motion mouse
    "\x1b[?1006l", // SGR mouse
    "\x1b[?1015l", // urxvt mouse
    "\x1b[?2004l", // bracketed paste
    "\x1b[<u", // Kitty keyboard: pop enhancement
    "\x1b[>0u", // Kitty keyboard: disable progressive enhancement
    "\x1b[?1049l", // leave alternate screen buffer
    "\x1b[?47l", // leave alt screen (legacy)
    "\x1b[?25h", // show cursor
    "\x1b[0m", // reset SGR (colors/styles)
    "\x1b[?7h", // auto-wrap on
    "\x1b[r", // reset scroll region
    "\r\n", // land on a clean line for the shell prompt
  ].join("");

  try {
    stdout.write(seq);
  } catch {
    /* ignore broken pipe */
  }
}
