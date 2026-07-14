# Shutdown flow (FR-27) — shell-safe teardown

Normative sequence for **every** exit path of the interactive cockpit.
Implementation: `src/ciview/runtime/shutdown.ts`,
`src/ciview/runtime/terminalRestore.ts`, wire-up in `src/ciview/main.tsx`.

## Goal

When the user presses **`q`**, **`Ctrl-c`**, or the process receives a
**catchable signal** (`SIGINT`, `SIGTERM`, …):

1. App resources stop (poll, queue, effects).
2. OpenTUI finishes **full** native terminal restore.
3. Belt-and-suspenders CSI reset runs (alt screen, Kitty CSI-u, cursor, raw mode).
4. Process exits `0`.
5. **Parent shell remains usable** — no leftover borders, no `08;5u…` garbage,
   no stuck raw mode.

## Forbidden anti-patterns

| Anti-pattern | Why it breaks the shell |
|--------------|-------------------------|
| `process.exit` on OpenTUI event `"destroy"` | Emitted **mid** `finalizeDestroy`, **before** `lib.destroyRenderer` restores the tty |
| `process.exit` before `renderer.destroy()` returns | Skips native leave-alt-screen / kitty-disable |
| Exit without `restoreTerminalTty` | Residual Kitty progressive enhancement (`CSI u`) leaks into the shell |
| Relying on `SIGKILL` | Uncatchable; no handler can restore the tty |

## Ordered flow (single-flight)

All triggers share **one** single-flight controller (`installGracefulShutdown`).

```text
 trigger: q | Ctrl-c (raw key) | SIGINT | SIGTERM | SIGQUIT | SIGHUP | …
     │
     ▼
 ┌───────────────────────────────────────────────────────────┐
 │ 1. cleanup (idempotent)                                   │
 │    · clear focus timers                                   │
 │    · stopPoll()                                           │
 │    · unwire selection effects                             │
 │    · queue.clear() (abort inflight)                       │
 └───────────────────────────────────────────────────────────┘
     │
     ▼
 ┌───────────────────────────────────────────────────────────┐
 │ 2. destroyRenderer (must complete)                        │
 │    · optional disableKittyKeyboard()                      │
 │    · renderer.destroy()                                   │
 │    · OpenTUI finalizeDestroy:                             │
 │         cleanupBeforeDestroy (raw mode off, stdin pause)  │
 │         emit("destroy")  ← DO NOT process.exit here       │
 │         lib.destroyRenderer (native tty restore)          │
 │         onDestroy callback  ← ONLY safe exit hook         │
 └───────────────────────────────────────────────────────────┘
     │
     ▼
 ┌───────────────────────────────────────────────────────────┐
 │ 3. afterRendererDestroyed / finish                        │
 │    · restoreTerminalTty()                                 │
 │         leave alt screen (?1049l / ?47l)                  │
 │         disable mouse / bracketed paste                   │
 │         Kitty pop + disable (<u , >0u)                    │
 │         show cursor (?25h), reset SGR (0m)                │
 │         setRawMode(false)                                 │
 │    · process.exit(0)                                      │
 └───────────────────────────────────────────────────────────┘
```

### Entry points

| Entry | Code path |
|-------|-----------|
| `q` | `App` → `onQuit` → `shutdown.quit(0)` |
| Ctrl+c (raw) | OpenTUI `exitOnCtrlC` → `renderer.destroy()` → `onDestroy` → `afterRendererDestroyed(0)` |
| SIGINT / SIGTERM / … | `process.on(signal)` → `shutdown.quit(0)` |
| OpenTUI `exitSignals` | same as destroy → `onDestroy` |

`quit` and `afterRendererDestroyed` both end in the same `finish()` so
double-fire is safe (single-flight flags).

## Modules

| Module | Responsibility |
|--------|----------------|
| `runtime/shutdown.ts` | `GRACEFUL_SIGNALS`, single-flight `quit` / `afterRendererDestroyed` |
| `runtime/terminalRestore.ts` | CSI sequences + raw mode off (shell safety) |
| `main.tsx` | Wire hooks; **only** `onDestroy` for post-destroy exit; never `"destroy"` event |

## Tests (bun:test)

- `runtime/shutdown.test.ts` — signals list; single-flight; afterRenderer path
- `runtime/terminalRestore.test.ts` — alt-screen / kitty / cursor sequences present

## Ops

Prefer `q`, `Ctrl-c`, or `kill -TERM <pid>`. Never document `kill -9` as normal
stop. If a hung process forces SIGKILL, operator runs `reset` on the tty.
