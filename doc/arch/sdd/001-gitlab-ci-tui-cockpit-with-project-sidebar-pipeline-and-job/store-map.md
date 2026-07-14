# Store Map — realtime interactive CLI

ciview is an **interactive realtime CLI** (TUI): the process stays open, reads
keys continuously, and **repaints from stores** whenever async jobs apply new
data. There is no request/response “print and exit” main path for the cockpit.

This document maps **which stores exist**, **who writes them**, **who observes
them**, and how that drives the screen.

## Principle

```text
keys → intents → p-queue (≤4) → handlers → store.apply
                                              ↓
                                    RxJS / selectors
                                              ↓
                                    React OpenTUI panes (realtime)
```

- **One writer path for server data:** job handlers via `store.apply`.
- **Local UI chrome** (focus pane, cursor index, filter draft, log scroll lock)
  may live in a small UI store or React local state — never mixed into GitLab
  entity payloads from the API.
- **Realtime** means: poll + user navigation enqueue work; when results land,
  observers push updates to the visible panes without restarting the process.

## Store topology

Prefer **sliced stores** (or one root with typed slices + selectors) so panes
subscribe narrowly and avoid full-tree redraws.

```text
                    ┌──────────────────── sessionStore ────────────────────┐
                    │ host, tokenSource, ready, fatalError                   │
                    └────────────────────┬─────────────────────────────────┘
                                         │
     ┌───────────────┬───────────────────┼───────────────────┬──────────────┐
     ▼               ▼                   ▼                   ▼              ▼
 projectsStore  pipelinesStore      jobsStore          traceStore     prefsStore
     │               │                   │                   │              │
     │               │                   │                   │              │
     └───────────────┴────────── selectionStore ─────────────┴──────────────┘
                                         │
                                         ▼
                                   uiChromeStore
                          (pane focus, cursors, filters, follow)
                                         │
                                         ▼
                              queueMetaStore (optional)
                     (pending counts, last job error, inflight keys)
```

## Slice catalog

| Store / slice | Holds | Written by | Observed by |
|---------------|-------|------------|-------------|
| **sessionStore** | `host`, `tokenSource`, bootstrap `ready`, fatal auth error | bootstrap + auth resolve | root app, status bar |
| **prefsStore** | `pins[]`, `pollIntervalMs`, `live` default, `sidebarVisible` default | LoadPrefs / SavePrefs handlers; pin / sidebar toggle | sidebar, poll timer, layout |
| **projectsStore** | `items[]`, `status` (idle/loading/error), `error?` | LoadProjects, optional LoadPulse | ProjectSidebar |
| **pipelinesStore** | `projectId`, `items[]`, `status`, `error?` | LoadPipelines, RefreshVisible | PipelineList |
| **jobsStore** | `pipelineId`, `items[]`, `stages[]` (derived), `status`, `error?` | LoadJobs, RefreshVisible | JobTree |
| **traceStore** | `jobId`, `text`/`lines` window, `status`, `followEligible` | LoadTrace, RefreshVisible | DetailLog |
| **selectionStore** | `projectId?`, `pipelineId?`, `jobId?`, **generations** per level | UI intents only (sync) | all panes + job coalesce/abort |
| **uiChromeStore** | `focusedPane`, row cursors, filter strings, `logFollow`, layout mode, **`sidebarVisible`**, **`helpOpen`**, help scroll offset | UI intents (sync) | all panes, status bar, Help overlay |
| **queueMetaStore** | inflight job keys, last error by pane, queue size | queue hooks / handlers | status bar (“loading…”, live dot) |

Token value stays **outside** stores (module-private auth context). Stores may
expose `tokenSource` only.

## Selection → invalidate map

When selection changes, update **selectionStore** immediately (realtime cursor),
bump generation, abort stale jobs, clear or mark stale the dependent slices,
then enqueue loads at **user** priority.

| Selection change | Clear / stale | Enqueue (user priority) |
|------------------|---------------|-------------------------|
| `projectId` | pipelines, jobs, trace | LoadPipelines |
| `pipelineId` | jobs, trace | LoadJobs |
| `jobId` | trace window | LoadTrace |

UI should show previous snapshot as **stale** or empty placeholder until the new
job applies — never flash another project’s pipelines under the new name.

## Realtime loop

| Source | Effect |
|--------|--------|
| Keypress | sync update selection/chrome → maybe enqueue user job |
| p-queue job complete | `apply` entity slice → observers → pane re-render |
| Poll timer | if `live` && **project open** → enqueue RefreshVisible (**poll** priority) even when CI is idle (FR-08b new pipelines); jobs for selected pipeline; trace only if log open + job active |
| Resize | uiChrome layout mode only (sync) |

**Interactive CLI contract**

1. Process remains in raw/alternate screen until `q`.
2. Every meaningful CI data change on screen comes from a store emission.
3. User input never waits on HTTP; at most sets “loading” in `queueMeta` / slice status.
4. Status bar reflects realtime meta: host, live on/off, inflight, last error.

## RxJS mapping (recommended)

| Stream | Source | Consumers |
|--------|--------|-----------|
| `selection$` | selectionStore | enqueue effects, pane highlight |
| `projects$` | projectsStore | ProjectSidebar |
| `pipelines$` | pipelinesStore | PipelineList |
| `jobs$` | jobsStore | JobTree |
| `trace$` | traceStore | DetailLog |
| `chrome$` | uiChromeStore | focus borders, filters |
| `queueMeta$` | queueMetaStore | status bar spinners |
| `liveTick$` | poll timer | gated RefreshVisible enqueue |

Effects that call `queue.add` subscribe to `selection$` / `liveTick$` in a thin
`src/runtime/effects.ts` (not inside React components).

## Pane ↔ store binding

| Pane | Primary stores | Notes |
|------|----------------|-------|
| ProjectSidebar | projects, prefs, selection, chrome | pulse from projects or light pulse field |
| PipelineList | pipelines, selection, chrome | failed culprit when jobs known |
| JobTree | jobs, selection, chrome | stages derived in jobsStore |
| DetailLog | trace, selection, chrome | follow flag in chrome |
| StatusBar | session, queueMeta, chrome, prefs.live | always visible; includes `?:help` hint |
| HelpOverlay | chrome.helpOpen + binding table | modal when open; not an entity store |

## File layout (implementation)

```text
src/state/
  session-store.ts
  prefs-store.ts
  projects-store.ts
  pipelines-store.ts
  jobs-store.ts
  trace-store.ts
  selection-store.ts
  ui-chrome-store.ts
  queue-meta-store.ts
  root.ts              # compose + typed RootState
  selectors.ts
src/runtime/effects.ts # selection$/liveTick$ → p-queue
src/ui/hooks/useStore.ts
```

Alternatively one `root.ts` with immer/redux-style slices — same **map**, different packaging. The slice boundaries above are normative for MVP.

## Non-goals for stores

- Persisting GitLab entities to disk
- Putting PAT in any store snapshot/log
- Letting React components write entity slices directly
