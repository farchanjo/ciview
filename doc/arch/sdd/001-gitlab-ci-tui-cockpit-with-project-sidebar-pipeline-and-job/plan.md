# Implementation Plan: GitLab CI TUI Cockpit (001)

## Overview

Implement **ciview** MVP: Bun + **TypeScript** + OpenTUI **React** application
that navigates GitLab CI via REST API v4 with a four-pane cockpit. Concurrency:
**`p-queue` with concurrency 4**, user jobs always ahead of poll, store/RxJS
observers for screen updates (ADR-0001, ADR-0002, ADR-0003).

## Goals

- Runnable `ciview` (bun entry) against self-hosted or gitlab.com
- Full keyboard navigation for the master–detail CI path
- Read-only API usage; pins + preferences on disk; no PAT in ciview config
- **Zero sync I/O on the UI path** — all GitLab/prefs work via `p-queue`

## Non-goals (this plan)

- CI mutations, multi-host UI, web UI, full child-pipeline DAG editor
- OS-level `Worker` threads / multi-process job runners (MVP)
- External brokers (Redis, etc.)
- Solid or non-React UI bindings
- Home-grown queue implementation

## Technical Approach

### Stack

| Piece | Choice |
|-------|--------|
| Runtime | **Bun** |
| Language | **TypeScript only** (strict) |
| TUI | `@opentui/core` + **React** OpenTUI binding (ADR-0003) |
| HTTP | Bun `fetch` inside **job handlers only** |
| Queue | **`p-queue`**, **`concurrency: 4`** |
| Priority | **user > poll > idle** (ADR-0002) |
| Reactive | **RxJS** for store streams/subjects bridged into React observe |
| Auth | env → glab config YAML parse |
| Config | XDG `ciview` prefs (pins, pollIntervalMs) — via `SavePrefs` job |
| Tests | `bun:test` for queue wiring, handlers, map, auth; mock fetch |

### Runtime architecture (authoritative)

```
UI keys (React) → dispatch(intent) → p-queue.add(job, { priority })
                                              │
                                     concurrency: 4
                                              │
                               handler: gitlab/prefs I/O
                                              │
                               store.apply(result | error)
                                              │
                    observers / RxJS → React OpenTUI re-render
```

**Rules**

1. UI never calls `gitlab.client` directly.
2. Poll timer enqueues `RefreshVisible` at **poll** priority when live + project
   open (FR-08b: always refresh pipeline strip so new pipelines appear while
   idle; never auto-switch selection on silent load).
3. User selection/manual refresh enqueues at **user** priority (always ahead).
4. Handlers never import OpenTUI/React render APIs.
5. Selection change bumps generation / aborts prior `AbortController`s.

### Package layout

```
src/ciview/                  # implementation root (codeRoot)
  main.ts
  cli/args.ts
  auth/resolve.ts
  gitlab/{client,types,map}.ts
  runtime/{queue,priorities,jobs,handlers,effects}.ts
  state/{createStore,root}.ts
  poll/timer.ts
  config/prefs.ts
  git/remote.ts
  ui/{App,keys,HelpOverlay}.tsx
  ui/panes/*  ui/chrome/*  ui/hooks/*
  util/*
```

### Dependencies (planned)

```text
p-queue
rxjs
react
@opentui/core
@opentui/react          # exact package name verified at T003
```

### Architecture layers

1. **UI (React)** — keys → intents; hooks observe store/RxJS
2. **Dispatch** — intent → `queue.add` with priority band
3. **p-queue** — concurrency 4; coalesce helpers around add
4. **Handlers** — GitLab client / prefs; return domain results
5. **Store + observers** — single source of truth; screen updates

Dependency rule:

`ui → dispatch/store`  
`handlers → gitlab/auth/config/store.apply`  
`ui` must not import `gitlab/client`  
`handlers` must not import `ui/**`

### Data flow

```
launch → resolve auth → start p-queue → enqueue LoadProjects (user)
user selects project → enqueue LoadPipelines (user) + abort prior gens
user selects pipeline → enqueue LoadJobs (user)
user selects job → enqueue LoadTrace (user)
poll tick (live + project open) → enqueue RefreshVisible (poll)
  · silent LoadPipelines (new pipelines; keep selection)
  · silent LoadJobs for selected pipeline
  · silent LoadTrace only if log open + job active
handler done → store.apply → RxJS/observers → React panes update
```

### Job table

| Kind | Payload key | Priority | Cancels with |
|------|-------------|----------|--------------|
| LoadProjects | host | user | session end |
| LoadPipelines | projectId | user or poll | project selection gen |
| LoadJobs | pipelineId | user or poll | pipeline selection gen |
| LoadTrace | jobId | user or poll | job selection gen |
| LoadPulse | projectId | poll/idle | optional |
| RefreshVisible | selection snapshot | poll | superseded by newer refresh |
| SavePrefs | prefs blob | idle | coalesce to latest |

### Keyboard map (MVP)

Normative full table: **`keybindings.md`**. Summary:

| Key | Action |
|-----|--------|
| `?` | Toggle **Help** overlay (cheatsheet from binding table) |
| `s` / `[` / `]` | Toggle / hide / show **sidebar** |
| Tab / S-Tab | next/prev pane (skip hidden sidebar) |
| `1`–`4` | focus projects / pipelines / jobs / detail |
| `H` / `L` | pane left / right |
| `j` / `k` | move in pane |
| Enter | drill (enqueue Load* at **user** priority) |
| Esc | close Help, or clear filter, or focus left |
| `/` | filter focused pane (letters disabled while typing) |
| `r` / `R` | refresh (**user**) / toggle live poll |
| `o` | open web_url |
| `p` | pin/unpin → SavePrefs (**idle**) |
| `f` | toggle log follow |
| `q` | quit gracefully (disabled while Help open; use Esc/`?` first) |
| `Ctrl-c` / SIGINT / SIGTERM / … | same graceful path (FR-27); **not** SIGKILL |

Status bar always shows compact hints including `?:help`.

### Graceful shutdown (FR-27)

Normative flow: **`shutdown-flow.md`**.

Single-flight order (must not reorder):

1. cleanup (poll, queue, effects, focus timers)
2. `renderer.destroy()` to completion (OpenTUI native restore)
3. `restoreTerminalTty()` (alt screen + Kitty CSI-u + cursor + raw off)
4. `process.exit(0)`

Wire-up rules in `main.tsx`:

- `onDestroy` → `afterRendererDestroyed` (only safe post-destroy exit hook)
- **never** `process.exit` on the mid-cycle `"destroy"` event
- `q` / process signals → `shutdown.quit`

Modules: `runtime/shutdown.ts`, `runtime/terminalRestore.ts`. Prefer
`SIGTERM` over `SIGKILL` for remote stop.

### Error handling

- Auth fail at bootstrap → message + exit 2
- Job failure → store error banner; last good data kept
- Abort/stale → silent drop
- Network → banner + next poll enqueues retry at poll priority

### Testing strategy

1. p-queue wiring: concurrency ≤ 4; user priority before poll
2. Coalesce + abort drops stale apply
3. Handlers with mock `fetch`
4. Auth fixtures; sanitizeTrace; stage grouping
5. Poll timer enqueues only when live+active
6. Manual smoke on real GitLab

### Build & scripts

```json
{
  "scripts": {
    "start": "bun run src/main.ts",
    "check": "bun test && tsc --noEmit",
    "test": "bun test",
    "build": "bun build src/main.ts --outdir dist --target bun"
  }
}
```

### Implementation phases

1. Scaffold Bun + TypeScript package; pin `p-queue`, `rxjs`, React, OpenTUI React
2. **Store map** slices + selectors/RxJS (no network) — interactive shell can render empty panes
3. `p-queue` concurrency 4 + priorities + fake handlers applying to slices
4. `effects.ts` selection → enqueue; poll timer → enqueue
5. Auth + GitLab client + real handlers
6. React OpenTUI panes bound 1:1 to store map + key dispatch (realtime CLI)
7. CLI focus modes, polish, tests, smoke
8. `speckit validate` green

Companion: `store-map.md` is normative for slice boundaries.

### Risks

| Risk | Mitigation |
|------|------------|
| OpenTUI React package name/API churn | Isolate `src/ui/**`; pin versions at T003 |
| RxJS overuse | Use for clear streams (selection, pane data, errors); avoid ceremony |
| Rate limits at concurrency 4 | Coalesce + backoff on 429; user priority still wins |
| Forgotten direct fetch in UI | Convention + review: client only under handlers |

## Companion Artifacts

- ADR-0002 (`p-queue`, 4, priorities), ADR-0003 (React)
- `data-model.md`, `quickstart.md`
- Gherkin + CUE under `doc/arch/`

## Success criteria

- FR-01…FR-19 (incl. 17b) implemented or explicitly deferred in tasks
- No UI path performs GitLab HTTP outside `p-queue`
- Measured concurrency never exceeds 4 running jobs
- User-priority job starts before queued poll jobs when both pending
- Manual smoke: project → pipeline → job → log with live poll
- `speckit validate` = 0 findings before commit
