# Implementation Plan: GitLab CI TUI Cockpit (001)

## Overview

Implement **ciview** MVP: a Bun + TypeScript + OpenTUI application that
navigates GitLab CI via REST API v4 with a four-pane cockpit (projects,
pipelines, stages/jobs, detail/log), glab/env auth, lazy loading, and smart
live polling. Concurrency model is **async-first on Bun**: job **queue**, async
**workers**, **store observers** for screen updates (ADR-0001, ADR-0002).

## Goals

- Runnable `ciview` (bun entry) against self-hosted or gitlab.com
- Full keyboard navigation for the master–detail CI path
- Read-only API usage; pins + preferences on disk; no PAT in ciview config
- **Zero sync I/O on the UI path** — all GitLab/prefs work via queue workers

## Non-goals (this plan)

- CI mutations, multi-host UI, web UI, full child-pipeline DAG editor
- OS-level `Worker` threads / multi-process job runners (MVP)
- External brokers (Redis, etc.)

## Technical Approach

### Stack

| Piece | Choice |
|-------|--------|
| Runtime | **Bun** (async event loop) |
| Language | TypeScript (strict) |
| TUI | `@opentui/core` + Solid binding (`@opentui/solid`) if stable; fallback React binding |
| HTTP | Bun `fetch` inside **job handlers only** |
| Concurrency | In-process async **queue** + **worker pool** + **observers** (ADR-0002) |
| Auth | env → glab config YAML parse |
| Config | XDG `ciview` prefs (pins, pollIntervalMs) — via `SavePrefs` job |
| Tests | `bun:test` for queue, handlers, map, auth; mock fetch |

### Runtime architecture (authoritative)

```
UI key/mouse  →  dispatch(intent)  →  enqueue(job)
                                         │
                              ┌──────────▼──────────┐
                              │  Async job queue     │
                              │  priority + coalesce │
                              └──────────┬──────────┘
                                         │
                         async workers (Bun, same process)
                                         │
                              handler: gitlab/prefs I/O
                                         │
                              store.apply(result | error)
                                         │
                              notify observers → OpenTUI re-render
```

**Rules**

1. UI never calls `gitlab.client` directly.
2. Poll timer only enqueues `RefreshVisible` (or specific Load* jobs).
3. Workers never import OpenTUI render APIs.
4. Selection change bumps generation / aborts prior `AbortController`s.

### Package layout

```
src/
  main.ts
  cli/args.ts
  auth/resolve.ts
  gitlab/
    client.ts              # used only from job handlers
    types.ts
    map.ts
  runtime/
    queue.ts               # enqueue, coalesce, priorities
    worker-pool.ts         # N async consumers
    jobs.ts                # job kinds + payloads
    handlers/
      load-projects.ts
      load-pipelines.ts
      load-jobs.ts
      load-trace.ts
      refresh-visible.ts
      save-prefs.ts
  state/
    store.ts               # state + subscribe/notify observers
    selectors.ts           # pane slices
  poll/timer.ts            # setInterval → enqueue only
  config/prefs.ts
  git/remote.ts
  ui/
    app.tsx                # observes store
    panes/...
    chrome/StatusBar.tsx
    keys.ts                # maps keys → intents (dispatch)
    statusGlyph.ts
  util/openUrl.ts
  util/sanitizeTrace.ts
```

### Architecture layers

1. **UI** — OpenTUI; keys → intents; observes store
2. **Dispatch** — intent → job enqueue (and local pure UI state if any)
3. **Queue + workers** — Bun async pool; cancellation; coalesce
4. **Handlers** — GitLab client / prefs; return domain results
5. **Store + observers** — single source of truth; screen updates

Dependency rule:

`ui → dispatch/store`  
`workers/handlers → gitlab/auth/config/store.apply`  
`ui` must not import `gitlab/client`  
`handlers` must not import `ui/**`

### Data flow

```
launch → resolve auth (sync OK: local files) → start workers → enqueue LoadProjects
user selects project → enqueue LoadPipelines (high) + abort prior pipeline/job jobs
user selects pipeline → enqueue LoadJobs
user selects job → enqueue LoadTrace
poll tick (if live + active) → enqueue RefreshVisible (normal)
handler done → store.apply → observers → panes update
```

### Job table

| Kind | Payload key | Priority | Cancels with |
|------|-------------|----------|--------------|
| LoadProjects | host | high | session end |
| LoadPipelines | projectId | high (user) / normal (poll) | project selection gen |
| LoadJobs | pipelineId | high / normal | pipeline selection gen |
| LoadTrace | jobId | high / normal | job selection gen |
| LoadPulse | projectId | low | optional |
| RefreshVisible | selection snapshot | normal | superseded by newer refresh |
| SavePrefs | prefs blob | low | coalesce to latest |

### Keyboard map (MVP)

| Key | Action |
|-----|--------|
| Tab / S-Tab | next/prev pane |
| h / l | pane left/right |
| j / k | move in pane |
| Enter | drill (enqueue LoadPipelines / LoadJobs / LoadTrace for the new focus) |
| Esc | focus left / collapse |
| / | filter active pane (local state) |
| r | enqueue refresh for focused resource |
| R | toggle live poll (store + timer) |
| o | open web_url (async spawn OK; not GitLab REST) |
| p | pin/unpin → enqueue SavePrefs |
| q | quit (drain/stop workers) |

### Error handling

- Auth fail at bootstrap → message + exit 2 (before workers usefully run)
- Job failure → `store.apply` error banner for that pane; last good data kept
- Abort/stale → silent drop (no error flash)
- Network → banner + next poll enqueues retry

### Testing strategy

1. Queue: coalesce, priority order, abort drops apply
2. Handlers: mock `fetch`, map to store patches
3. Auth resolve fixtures
4. sanitizeTrace / stage grouping pure tests
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

1. Scaffold Bun package
2. Store + observers (no network)
3. Queue + worker pool + job types (echo/fake handlers)
4. Auth + GitLab client + real handlers
5. Poll timer → enqueue
6. OpenTUI panes observing store + key dispatch
7. CLI focus modes, polish, tests, smoke
8. `speckit validate` green

### Risks

| Risk | Mitigation |
|------|------------|
| Queue over-engineering | Keep ~100–200 LOC queue; no external broker |
| OpenTUI churn | Isolate `src/ui/**` |
| Huge traces | Tail in LoadTrace handler; store only window |
| Forgotten direct fetch in UI | Lint/convention: client only under handlers |
| OS Worker confusion | Document: “worker” = async consumer, not `new Worker` |

## Companion Artifacts

- ADR-0002 async runtime
- `data-model.md`, `quickstart.md`
- Gherkin + CUE under `doc/arch/`

## Success criteria

- FR-01…FR-19 implemented or explicitly deferred in tasks
- No UI path performs GitLab HTTP outside the queue
- Manual smoke: project → pipeline → job → log with live poll
- `speckit validate` = 0 findings before commit
