import { describe, expect, test } from "bun:test";
import {
  GRACEFUL_SIGNALS,
  UNCATCHABLE_TERMINATION,
  installGracefulShutdown,
} from "./shutdown.ts";

describe("graceful shutdown (FR-27)", () => {
  test("SIGTERM/SIGINT/SIGQUIT are catchable; SIGKILL is not", () => {
    expect(GRACEFUL_SIGNALS).toContain("SIGINT");
    expect(GRACEFUL_SIGNALS).toContain("SIGTERM");
    expect(GRACEFUL_SIGNALS).toContain("SIGQUIT");
    expect(GRACEFUL_SIGNALS).toContain("SIGHUP");
    expect((GRACEFUL_SIGNALS as readonly string[]).includes("SIGKILL")).toBe(false);
    expect(UNCATCHABLE_TERMINATION).toContain("SIGKILL");
    expect(UNCATCHABLE_TERMINATION).toContain("SIGSTOP");
  });

  test("quit runs cleanup → destroy → exit once (single-flight)", () => {
    const calls: string[] = [];
    const { quit, dispose } = installGracefulShutdown({
      cleanup: () => calls.push("cleanup"),
      destroyRenderer: () => calls.push("destroy"),
      exitProcess: (code) => calls.push(`exit:${code ?? 0}`),
    });
    quit(0);
    quit(0);
    quit(1);
    // cleanup may run in quit and again in finish — still single exit
    expect(calls.filter((c) => c === "destroy")).toEqual(["destroy"]);
    expect(calls.filter((c) => c.startsWith("exit:"))).toEqual(["exit:0"]);
    expect(calls[0]).toBe("cleanup");
    expect(calls).toContain("destroy");
    dispose();
  });

  test("afterRendererDestroyed finishes without requiring second destroy", () => {
    const calls: string[] = [];
    const { afterRendererDestroyed, quit, dispose } = installGracefulShutdown({
      cleanup: () => calls.push("cleanup"),
      destroyRenderer: () => calls.push("destroy"),
      exitProcess: (code) => calls.push(`exit:${code ?? 0}`),
    });
    // Simulate OpenTUI path: destroy already ran, onDestroy fires
    afterRendererDestroyed(0);
    quit(0); // no-op finish
    expect(calls.filter((c) => c.startsWith("exit:"))).toEqual(["exit:0"]);
    expect(calls.filter((c) => c === "destroy")).toEqual([]);
    dispose();
  });
});
