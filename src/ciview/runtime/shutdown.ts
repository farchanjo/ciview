import { restoreTerminalTty } from "./terminalRestore.ts";

/**
 * Graceful process shutdown (FR-27).
 *
 * Catchable Unix/Windows signals we handle. **SIGKILL cannot be caught** by any
 * process (kernel terminates immediately) — operators should use SIGTERM
 * (`kill <pid>` / `kill -TERM`) for clean exit; `kill -9` will leave the
 * terminal possibly dirty if raw mode was active.
 */
export const GRACEFUL_SIGNALS = [
  "SIGINT", // Ctrl+C (also OpenTUI keypath in raw mode)
  "SIGTERM", // default `kill <pid>`
  "SIGQUIT", // Ctrl+\
  "SIGHUP", // terminal hangup
  "SIGABRT",
  "SIGBREAK", // Windows break
] as const;

export type GracefulSignal = (typeof GRACEFUL_SIGNALS)[number];

/** Signals that cannot be intercepted (document only; never registered). */
export const UNCATCHABLE_TERMINATION = ["SIGKILL", "SIGSTOP"] as const;

export interface ShutdownHooks {
  /** Stop poll, effects, queue, focus timers. Idempotent. */
  cleanup: () => void;
  /**
   * Destroy OpenTUI renderer (must run to completion so native tty restore
   * finishes). Must NOT call process.exit itself.
   */
  destroyRenderer: () => void;
  /**
   * Final step after destroy + tty restore. Should call process.exit.
   * Invoked only once after restoreTerminalTty.
   */
  exitProcess: (code?: number) => void;
}

/**
 * Build an idempotent graceful quit and attach catchable signal handlers.
 *
 * Order (critical — do not process.exit mid-destroy):
 * 1. cleanup app resources
 * 2. destroyRenderer (OpenTUI full finalize including native restore)
 * 3. restoreTerminalTty (belt-and-suspenders CSI reset)
 * 4. exitProcess
 */
export function installGracefulShutdown(hooks: ShutdownHooks): {
  quit: (code?: number) => void;
  /** Call from OpenTUI `onDestroy` only (after native teardown finished). */
  afterRendererDestroyed: (code?: number) => void;
  dispose: () => void;
} {
  let quitting = false;
  let finished = false;
  const listeners: Array<{ signal: NodeJS.Signals; fn: () => void }> = [];

  const finish = (code = 0) => {
    if (finished) return;
    finished = true;
    try {
      hooks.cleanup();
    } catch {
      /* best-effort */
    }
    try {
      restoreTerminalTty();
    } catch {
      /* best-effort */
    }
    hooks.exitProcess(code);
  };

  const quit = (code = 0) => {
    if (quitting) return;
    quitting = true;
    try {
      hooks.cleanup();
    } catch {
      /* best-effort */
    }
    try {
      hooks.destroyRenderer();
    } catch {
      /* already destroyed */
    }
    // If destroy is sync and already called onDestroy → afterRendererDestroyed,
    // finish() is a no-op. If destroy was a no-op (already dead), finish now.
    finish(code);
  };

  /** Safe to call from onDestroy at end of OpenTUI finalizeDestroy. */
  const afterRendererDestroyed = (code = 0) => {
    quitting = true;
    finish(code);
  };

  for (const signal of GRACEFUL_SIGNALS) {
    const fn = () => quit(0);
    try {
      process.on(signal, fn);
      listeners.push({ signal, fn });
    } catch {
      // Signal may not exist on this platform (e.g. SIGBREAK on Unix variants).
    }
  }

  const dispose = () => {
    for (const { signal, fn } of listeners) {
      try {
        process.off(signal, fn);
      } catch {
        /* ignore */
      }
    }
    listeners.length = 0;
  };

  return { quit, afterRendererDestroyed, dispose };
}
