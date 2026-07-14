---
status: accepted
date: 2026-07-14
deciders: [farchanjo]
consulted: []
informed: []
---

# ADR-0002: Async runtime — Bun queue, workers, observers

## Context and Problem Statement

ciview is a TUI that continuously talks to GitLab (list projects, pipelines,
jobs, traces) while the user navigates. Blocking the render path on HTTP would
freeze the terminal. Ad-hoc `await` inside UI event handlers does not scale to
live poll, multi-pane invalidation, cancellation, and concurrent fetches.

We need a single concurrency model for all I/O and background work, on **Bun**.

## Decision Drivers

- UI must never block on network I/O
- Live poll and user navigation must compose without racey double-fetches
- Selection changes must supersede stale work
- Bun is the only runtime (native async, `fetch`, timers)
- Prefer simplicity: CI view is I/O-bound, not CPU-bound
- Screen updates via explicit observation of state, not imperative redraw sprinkled in fetch code

## Considered Options

- **A.** Async in-process job **queue** + **worker pool** (async task runners on Bun’s event loop) + **store observers** for UI (chosen)
- **B.** Call GitLab directly from UI key handlers with scattered `await`
- **C.** OS-level `Worker` threads for every API call (Bun `Worker` / web workers)
- **D.** External broker (Redis, etc.) for jobs

## Decision Outcome

Chosen option: **A**.

### Model

```
┌─────────────┐   intents    ┌──────────────┐  jobs   ┌─────────────────┐
│ OpenTUI UI  │ ───────────► │ Dispatcher   │ ──────► │ Async job queue │
│ (keys only) │              │ (enqueue)    │         │ + priorities    │
└──────▲──────┘              └──────────────┘         └────────┬────────┘
       │ observe                                                 │
       │                                              N async workers
┌──────┴──────┐              ┌──────────────┐         (Bun event loop)
│ Store       │ ◄── apply ── │ Job handlers │ ◄────── fetch / map / prefs
│ + observers │              │ (gitlab I/O) │
└─────────────┘              └──────────────┘
```

1. **Queue** — all side effects that need GitLab, disk prefs I/O, or scheduled
   poll are **jobs** enqueued with a type, payload, priority, and optional
   `AbortSignal` / generation token.
2. **Workers** — a small pool of **async workers** (concurrent consumers on the
   same Bun process/event loop), not OS threads by default. They `dequeue` →
   run handler → `store.apply(result)` or `store.apply(error)`.
3. **Observers** — the UI (and poll controller) **subscribe** to store slices;
   when state changes, observers update the screen. Fetch code never calls
   paint/render APIs.
4. **Async everywhere** — no synchronous network; handlers are `async`; timers
   only enqueue jobs (`tick` → `enqueue(RefreshVisible)`), they do not fetch.

### Bun specifics

| Concern | Choice |
|---------|--------|
| Runtime | Bun only |
| Concurrency | `async`/`await` + Promise-based queue on the main event loop |
| HTTP | Bun `fetch` inside job handlers |
| Cancellation | `AbortController` per job / per selection generation |
| Timers | `setInterval`/`setTimeout` only schedule enqueue |
| OS `Worker` | **Not used in MVP** — reserved if later CPU-heavy parse needs isolation |
| Shared memory | Single process; store is the shared state |

### Job kinds (MVP)

| Job | Trigger | Priority |
|-----|---------|----------|
| `LoadProjects` | startup, manual refresh | high |
| `LoadPipelines` | project selected / poll | high if user, normal if poll |
| `LoadJobs` | pipeline selected / poll | high if user, normal if poll |
| `LoadTrace` | job selected / poll while running | high if user, normal if poll |
| `LoadPulse` | optional sidebar pulse | low |
| `SavePrefs` | pin toggle | low |
| `RefreshVisible` | poll timer when live | normal |

### Coalescing and stale work

- Coalesce duplicate jobs of the same kind+key (e.g. one `LoadPipelines` per
  `projectId` in queue).
- On selection change, bump a **generation** (or abort controllers) so in-flight
  results for old project/pipeline/job are dropped before `apply`.
- User-driven jobs preempt or run ahead of poll jobs (priority).

### Consequences

- Good: TUI stays responsive; clear test surface (queue + handlers + store);
  poll and navigation share one pipeline; observers keep UI dumb.
- Good: Fits Bun without multi-process complexity.
- Bad: Must implement a small queue (or thin library) instead of “just await in
  the component” — accepted cost.
- Bad: OS Workers not used — if log sanitization ever becomes heavy, add a
  dedicated worker later without changing the job API.
- Bad: Single-threaded CPU — acceptable for I/O-bound GitLab client.

## Relationship

- Supersedes the informal “store + poll scheduler calls client” sketch in the
  initial plan with an explicit **queue/worker/observer** runtime.
- Complements ADR-0001 (Bun + OpenTUI + REST).
