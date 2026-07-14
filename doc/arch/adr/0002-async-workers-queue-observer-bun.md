---
status: accepted
date: 2026-07-14
deciders: [farchanjo]
consulted: []
informed: []
---

# ADR-0002: Async runtime — Bun, p-queue, 4 workers, observers

## Context and Problem Statement

ciview is a TUI that continuously talks to GitLab (list projects, pipelines,
jobs, traces) while the user navigates. Blocking the render path on HTTP would
freeze the terminal. Ad-hoc `await` inside UI event handlers does not scale to
live poll, multi-pane invalidation, cancellation, and concurrent fetches.

We need a single concurrency model for all I/O and background work, on **Bun**,
with explicit library choices.

## Decision Drivers

- UI must never block on network I/O
- Live poll and user navigation must compose without racey double-fetches
- Selection changes must supersede stale work
- Bun is the only runtime (native async, `fetch`, timers)
- Prefer proven small libraries over a home-grown queue
- User-driven work must always outrank background poll
- Screen updates via observation of state, not paint calls from fetch code
- Everything in **TypeScript**

## Considered Options

### Queue implementation

- **A.** Home-grown ~100 LOC priority queue
- **B.** [`p-queue`](https://github.com/sindresorhus/p-queue) (chosen)
- **C.** External broker (Redis, etc.)

### Concurrency width

- **A.** 2 concurrent jobs
- **B.** 4 concurrent jobs (chosen)
- **C.** Unbounded

### Reactive observation

- **A.** Manual `subscribe`/`notify` only
- **B.** **RxJS** streams/subjects for store slices and job events (allowed and preferred where it simplifies) plus React re-render (chosen direction)
- **C.** OS `Worker` threads for every API call

## Decision Outcome

Chosen option: **p-queue with concurrency 4, user priority over poll, RxJS-friendly observers on Bun** (queue option B, concurrency B, reactive B) — not a home-grown queue, not unbounded concurrency, not OS workers per request.

### Runtime model

```
┌─────────────┐   intents    ┌──────────────┐  add    ┌─────────────────┐
│ OpenTUI UI  │ ───────────► │ Dispatcher   │ ──────► │ p-queue         │
│ (React)     │              │ (enqueue)    │         │ concurrency: 4  │
└──────▲──────┘              └──────────────┘         │ priorities      │
       │ observe                                         └────────┬────────┘
       │ (RxJS / store)                                           │
┌──────┴──────┐              ┌──────────────┐         up to 4 async
│ Store       │ ◄── apply ── │ Job handlers │ ◄────── jobs on Bun loop
│ + observers │              │ (gitlab I/O) │
└─────────────┘              └──────────────┘
```

1. **Queue = `p-queue`** — all GitLab HTTP, prefs I/O, and scheduled poll are
   tasks added to a `PQueue` with **`concurrency: 4`**.
2. **Workers** — “4 workers” means **4 concurrent async jobs** on Bun’s event
   loop via `p-queue` concurrency, **not** OS `Worker` threads in MVP.
3. **Priority** — **user jobs always ahead of poll jobs** (see priority table).
   Use `p-queue` priority support (higher number = sooner) so navigation never
   waits behind a backlog of `RefreshVisible` / pulse work.
4. **Observers** — UI updates by observing store (and optionally **RxJS**
   `Subject`/`Observable` streams for selection, pane data, errors, queue
   depth). Job handlers never call terminal paint APIs.
5. **Async everywhere** — no synchronous network on the input path; poll timers
   only enqueue (`tick` → `queue.add(RefreshVisible, { priority: poll })`).

### Locked numbers and libraries

| Concern | Choice |
|---------|--------|
| Runtime | Bun only |
| Language | TypeScript only |
| Queue lib | **`p-queue`** |
| Concurrency | **4** concurrent fetches/jobs |
| User vs poll | **User jobs always higher priority than poll** |
| Reactive helpers | **RxJS** allowed/preferred for streams + bridging to React |
| HTTP | Bun `fetch` inside job handlers |
| Cancellation | `AbortController` per job / selection generation; drop stale applies |
| OS `Worker` | Not used in MVP |

### Priority bands (higher runs first)

| Band | Value (example) | Used by |
|------|-----------------|---------|
| User | 20 | Load* triggered by key/selection, manual `r` refresh |
| Poll | 10 | `RefreshVisible`, background pulse while live |
| Idle | 5 | `SavePrefs`, optional low-priority housekeeping |

Within a band, FIFO is acceptable. Coalesce same kind+resource key so rapid
input does not stampede.

### Job kinds (MVP)

| Job | Trigger | Priority band |
|-----|---------|---------------|
| `LoadProjects` | startup, manual refresh | user |
| `LoadPipelines` | project selected | user |
| `LoadPipelines` | poll | poll |
| `LoadJobs` | pipeline selected | user |
| `LoadJobs` | poll | poll |
| `LoadTrace` | job selected / running follow | user / poll |
| `LoadPulse` | sidebar pulse | poll or idle |
| `SavePrefs` | pin toggle | idle |
| `RefreshVisible` | poll timer when live | poll |

### Coalescing and stale work

- Coalesce duplicate jobs of the same kind+key while queued/running.
- On selection change, bump generation and/or abort so late results cannot
  overwrite newer pane data.
- User band always outranks poll band (**confirmed** product rule).

### Consequences

- Good: TUI stays responsive; 4-wide I/O matches multi-pane refresh without
  unbounded fan-out; `p-queue` is small, typed, and well-known.
- Good: RxJS optional but welcome for composing poll, selection, and UI props.
- Bad: Depends on `p-queue` / `rxjs` versions — pin in `package.json`.
- Bad: OS Workers still unused — add later only for CPU-heavy log work.

## Relationship

- Complements ADR-0001 (Bun + OpenTUI + REST) and ADR-0003 (React UI).
- Replaces “home-grown queue ~100 LOC” sketch with **`p-queue` + concurrency 4**.
