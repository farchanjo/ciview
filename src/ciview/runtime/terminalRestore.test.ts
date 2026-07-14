import { describe, expect, test } from "bun:test";
import { restoreTerminalTty } from "./terminalRestore.ts";

describe("restoreTerminalTty (FR-27 shell safety)", () => {
  test("writes leave-alt-screen, show-cursor, and kitty-disable sequences", () => {
    const chunks: string[] = [];
    const stdout = {
      writable: true,
      write(s: string) {
        chunks.push(s);
        return true;
      },
    } as unknown as NodeJS.WriteStream;

    let raw = true;
    const stdin = {
      isTTY: true,
      setRawMode(mode: boolean) {
        raw = mode;
      },
      pause() {},
    } as unknown as NodeJS.ReadStream;

    restoreTerminalTty(stdin, stdout);

    expect(raw).toBe(false);
    const out = chunks.join("");
    expect(out).toContain("\x1b[?1049l"); // leave alt screen
    expect(out).toContain("\x1b[?25h"); // show cursor
    expect(out).toContain("\x1b[0m"); // reset SGR
    expect(out).toContain("\x1b[<u"); // kitty pop
    expect(out).toContain("\x1b[>0u"); // kitty disable
    expect(out).toContain("\x1b[?2004l"); // bracketed paste off
  });

  test("no-ops write when stdout not writable", () => {
    const stdout = {
      writable: false,
      write() {
        throw new Error("should not write");
      },
    } as unknown as NodeJS.WriteStream;
    expect(() => restoreTerminalTty(process.stdin, stdout)).not.toThrow();
  });
});
