---
id: 019f61b4-089c-7961-a6e5-d83244cb7931
number: 001
slug: gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job
status: implemented
created_at: 2026-07-14T17:36:56.476546Z
---
# Feature Specification: GitLab CI TUI Cockpit

Feature: 001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job
Created: 2026-07-14

## Summary

Ship **ciview**, a Bun + OpenTUI **interactive realtime CLI** (long-lived TUI)
that provides a multi-pane, keyboard-first GitLab CI navigator: project sidebar
→ pipelines → stages/jobs → job detail and log. Read-mostly MVP with live
polling while CI is active. Auth reuses glab config or standard GitLab
environment variables. Runtime is **async-first on Bun**: `p-queue`, store
slices, observers/RxJS (ADR-0002) — the UI never blocks on HTTP. Screen state
is **fully store-mapped** (see `store-map.md`).

## User Stories

- As a **developer**, I want to open ciview in a repo and see the latest
  pipelines and jobs so that I can watch CI without leaving the terminal.
- As a **developer**, I want to drill into a failed job log so that I can
  diagnose failures quickly.
- As an **operator**, I want a left sidebar of projects with CI status pulse and
  pins so that I can jump across infra projects easily.
- As any **user**, I want clear status visualization and live updates while a
  pipeline is running so that I can “see CI happen.”
- As any **user**, I want to open the current pipeline or job in the browser so
  that I can use the GitLab UI when needed.

## Functional Requirements

1. **FR-01 Auth bootstrap (glab only).** On start, resolve GitLab base URL and
   token **only from glab** (binary on PATH + glab config / logged-in host).
   - If glab is not installed: exit non-zero with clear steps to **(1) install
     glab** and **(2) authenticate** (`glab auth login`).
   - If glab is installed but not authenticated / no token: exit non-zero with
     clear steps to **authenticate**.
   - Never call the API with an empty token. Do not use env PAT as the primary
     credential source.
2. **FR-02 Project sidebar.** Show a left-hand list of accessible projects
   (membership). Support path filter and pinned projects at the top. Each row
   shows a CI pulse (status of the latest known pipeline when loaded).
3. **FR-03 Pipeline list.** Selecting a project loads that project’s pipelines
   (paginated). Each row shows at least: iid/id, ref, status, source, duration
   or timestamps, and web-oriented identity for open-in-browser.
4. **FR-04 Failed culprit hint.** When a pipeline status is failed and job data
   is available, surface the name of a failed job on the pipeline row or detail
   chrome.
5. **FR-05 Jobs by stage.** Selecting a pipeline loads jobs grouped by stage,
   with status glyph, name, duration, and allow_failure distinction.
6. **FR-06 Job detail and log.** Selecting a job shows metadata and fetches job
   trace/log. While the job is running, follow the tail; if the user scrolls up,
   pause follow until they return to bottom or toggle follow.
7. **FR-07 Shortcut-first navigation.** Every primary action has a keyboard
   shortcut defined in `keybindings.md`. Support panel focus, move within
   panel, Enter to drill down, Esc hierarchy, filter, refresh, live toggle,
   open in browser, pin, quit. Status bar always shows a compact hint including
   `?:help`.
8. **FR-08 Live poll.** While **live** is on and a **project is open**
   (`selection.projectId` set), refresh on a configurable short interval
   (default 3s) via silent `RefreshVisible` (no loading flash).
   - **FR-08b New pipelines while idle.** Pipeline strip is always re-fetched
     for the open project even when every pipeline/job is terminal
     (`success`/`failed`/…). A newly created pipeline appears in the strip
     without requiring manual `r`. Selection and board focus **must not**
     auto-switch to the new pipeline; the operator keeps the pipeline they
     were viewing (strip cursor re-synced by `pipelineId`, not by list index).
   - **Jobs/trace depth.** Jobs refresh for the currently selected pipeline;
     job trace refreshes only while the log drawer is open and that job is
     still in an active CI state.
   - Live **off** or no project open → no automatic poll (manual `r` still
     works).
9. **FR-09 Open in browser.** Action opens the GitLab `web_url` for the focused
   pipeline or job via the OS default opener.
10. **FR-10 CLI focus.** Support at least: default dashboard launch; focus
    project from current git remote (`.`); focus by `path/with/namespace`.
11. **FR-11 Read-only API use.** MVP issues only read operations required for
    the view (projects, pipelines, jobs, bridges when child pipelines exist,
    job trace). No retry/cancel/play.
12. **FR-12 Responsive layout.** At sufficient terminal width, show four panes
    (projects | pipelines | jobs | detail/log). At narrow width, collapse to
    fewer panes with drill-down preserving the same data model.
13. **FR-13 Child pipelines (minimal).** If bridges exist, list them and allow
    navigation into the child pipeline’s jobs (depth can be simple stack, not a
    full DAG editor).
14. **FR-14 Local preferences.** Persist pins and poll interval under
    `~/.config/ciview/` (or XDG equivalent). Never store the PAT there if it
    already lives in glab/env.
15. **FR-15 Async job queue.** All GitLab fetches and prefs persistence run as
    jobs on an in-process Bun async queue (kinds at least: LoadProjects,
    LoadPipelines, LoadJobs, LoadTrace, RefreshVisible, SavePrefs). UI and
    key handlers only enqueue intents — they do not `await` HTTP inline.
16. **FR-16 Async workers (concurrency 4).** Use **`p-queue` with
    `concurrency: 4`** so at most four GitLab/prefs jobs run at once on the Bun
    event loop. “Worker” means a concurrent async slot, not an OS `Worker`
    thread in MVP. Handlers apply success or error results to the store.
17. **FR-17 Store observers (React + optional RxJS).** The React OpenTUI layer
    updates exclusively by observing store changes (subscribe/notify and/or
    RxJS streams bridged into React). Job handlers must not call terminal paint
    APIs.
17b. **FR-17b User priority over poll.** Jobs enqueued from user navigation or
    manual refresh always use a higher `p-queue` priority than poll/pulse jobs
    so interactive work is never stuck behind background refresh.
18. **FR-18 Stale-job safety.** On project/pipeline/job selection change, in-flight
    jobs for the previous selection are aborted or their results discarded
    (generation token and/or `AbortController`) so a slow response cannot
    overwrite newer pane data.
19. **FR-19 Job coalescing.** Duplicate jobs of the same kind and resource key
    while one is queued or running are coalesced (no stampede on rapid key
    repeat or poll overlap).
20. **FR-20 Interactive realtime CLI.** The main cockpit is a long-lived
    interactive process (not print-and-exit). It continuously accepts keyboard
    input and updates the terminal in realtime when stores change, until the
    user quits.
21. **FR-21 Store map.** Domain and UI state follow the slice map in
    `store-map.md`: at least session, prefs, projects, pipelines, jobs, trace,
    selection, and uiChrome. React panes bind to stores/selectors (or RxJS
    streams derived from them), not to ad-hoc component-local copies of GitLab
    entities.
22. **FR-22 Selection is sync; data is async.** Changing selection updates
    selection/uiChrome stores immediately (cursor/highlight realtime). Loading
    pipelines/jobs/trace only happens via enqueued jobs that later `apply` to
    entity slices.
23. **FR-23 Status bar realtime meta.** A status bar (or equivalent chrome)
    reflects live host, live-poll on/off, and loading/error hints from store
    meta so the user sees async work without guessing.
24. **FR-24 Help overlay for shortcuts.** Pressing `?` toggles an in-app Help
    overlay that lists all shortcuts from the same binding table used by the
    key dispatcher (grouped categories). While Help is open it is modal: `?` or
    `Esc` closes it; `q` does not quit until Help is closed. Help is scrollable
    if the cheatsheet exceeds the terminal height.
25. **FR-25 Hideable project sidebar.** The project sidebar can be shown or
    hidden via shortcuts (`s` toggle; `[` hide; `]` show per `keybindings.md`).
    When hidden, layout reflows to remaining panes; selected project context
    remains; status bar may show compact project path. Visibility is stored in
    `uiChromeStore` and may persist in prefs (default visible).
26. **FR-26 Single binding table.** Keybindings are defined once in code (and
    documented in `keybindings.md`); the Help overlay renders that table so
    help and behavior cannot drift.
27. **FR-27 Graceful process shutdown (shell-safe).** Leaving the cockpit always
    runs a **single-flight** teardown that leaves the **parent shell usable**.
    Normative step-by-step order is in `shutdown-flow.md` (must stay in sync
    with code). Required sequence:
    1. **cleanup** — stop poll timer; abort/clear job queue; unwire selection
       effects; clear focus timers.
    2. **destroyRenderer** — optional `disableKittyKeyboard`; `renderer.destroy()`
       must run to completion (OpenTUI native tty restore inside
       `finalizeDestroy`).
    3. **restoreTerminalTty** — belt-and-suspenders CSI: leave alt screen,
       disable mouse/bracketed paste, Kitty keyboard pop/disable (`CSI < u`,
       `CSI > 0 u`), show cursor, reset SGR, `setRawMode(false)`.
    4. **process.exit(0)** — only after steps 1–3 so the event loop cannot hang
       and the shell is not left dirty.
    Triggers (all share the same path / flags):
    | Trigger | Notes |
    |---------|--------|
    | `q` | Disabled while Help is open → `shutdown.quit` |
    | `Ctrl-c` | OpenTUI raw-mode keypath → destroy → `onDestroy` |
    | `SIGINT` | Terminal interrupt → `shutdown.quit` |
    | `SIGTERM` | Default `kill <pid>` — preferred remote stop |
    | `SIGQUIT` | Quit signal |
    | `SIGHUP` | Terminal hangup |
    | `SIGABRT` / `SIGBREAK` | When the platform delivers them |
    **Hard rules:**
    - `process.exit` MUST NOT run on the OpenTUI `"destroy"` event (emitted
      mid-finalize, before native restore). Use config **`onDestroy`** only
      (`afterRendererDestroyed`).
    - MUST NOT skip `restoreTerminalTty` after destroy (prevents Kitty
      `…;5u` garbage and residual blue alt-screen borders in the shell).
    - **SIGKILL / SIGSTOP** are uncatchable; operators MUST prefer `q` /
      `Ctrl-c` / `SIGTERM`. After forced `-9`, run `reset` on the tty.
    Implementation: `src/ciview/runtime/shutdown.ts`,
    `src/ciview/runtime/terminalRestore.ts`, wire-up `src/ciview/main.tsx`.

## Non-Functional Requirements

1. **NFR-01 Stack.** Bun runtime; **TypeScript only**; OpenTUI + **React** for
   the TUI (ADR-0003); thin GitLab REST v4 client; **`p-queue` (concurrency 4)**
   + observers/RxJS (ADR-0002).
2. **NFR-02 Performance.** Selecting a project should present the first page of
   pipelines without multi-second UI freezes on a normal LAN to self-hosted
   GitLab (target: interactive within ~2s for typical page sizes). Keyboard
   handling remains responsive while jobs run (no sync network on input path).
3. **NFR-03 Resilience.** API errors keep the last good snapshot, show an error
   indicator, and retry on the next poll without crashing the TUI.
4. **NFR-04 Secrets.** Tokens never logged, never committed, never embedded in
   screenshots/docs by automation.
5. **NFR-05 English UI (MVP).** User-visible strings in English for MVP.
6. **NFR-06 Async-only I/O.** No synchronous HTTP or blocking disk APIs on the
   UI/input path; all such work is scheduled on the queue.
7. **NFR-07 Realtime feel.** Key-driven selection/focus updates appear on the
   next render frame without waiting for network. Entity pane contents may show
   loading/stale until the corresponding job applies.
8. **NFR-08 Learnable UI.** A new user can discover core navigation using only
   the status bar hint and the `?` Help overlay, without reading external docs.

## Out of Scope (this feature)

- Mutating CI (retry, cancel, play manual jobs)
- Issues, MR authoring, source browser, registry, runner admin
- Multi-host switcher UI (single resolved host per session is enough)
- Full offline mode / local pipeline DB
- Editing `.gitlab-ci.yml`

## Security Requirements

- **Data sensitivity/classification.** Reads GitLab project metadata, pipeline
  and job metadata, commit author fields returned by the API, and job traces
  (which may contain secrets accidentally printed by CI). Classification:
  internal/confidential relative to the token’s GitLab authorization. No
  writes of that data to remote systems by ciview.
- **Authentication/authorization.** Reuses operator-provided PAT/OAuth token via
  env or glab. Does not implement its own IdP. Authorization is entirely
  GitLab’s; ciview must not attempt to bypass project visibility.
- **Input validation.** Bounds CLI args, filter strings, and API JSON parsing
  with schema/types; rejects absurd page sizes; treats job trace as untrusted
  text for display (control characters sanitized for terminal safety).
- **Cryptography in transit/at rest.** HTTPS to GitLab API (as configured by
  host URL). No separate encryption of pins file beyond OS file permissions;
  pins must not include tokens.
- **Logging/audit.** Logs auth failure class, HTTP status, and operation name —
  never raw tokens or full `Authorization` headers. No mandatory third-party
  telemetry in MVP.
- **Error-handling information exposure.** User-facing errors are actionable
  (“auth missing”, “403 project”, “network timeout”) without dumping response
  bodies that may include private payloads by default (debug flag may increase
  detail locally).

## Acceptance Scenarios

1. Given valid glab auth for a host, When the user runs `ciview`, Then the
   project sidebar lists membership projects without a token error.
2. Given a selected project with pipelines, When the user focuses the pipelines
   pane, Then pipeline rows show status and ref.
3. Given a selected pipeline, When the user opens jobs, Then jobs are grouped by
   stage with status indicators.
4. Given a running job, When live poll is enabled, Then status/log update without
   manual refresh within one poll interval after the API changes.
5. Given an open project with only terminal pipelines and live on, When GitLab
   creates a new pipeline for that project, Then within one poll interval the
   strip shows the new pipeline and the previously selected pipeline remains
   selected (no forced board jump).
5. Given a focused pipeline with `web_url`, When the user triggers open-in-
   browser, Then the OS opens that URL.
6. Given no token and no glab credentials, When the user starts ciview, Then the
   process exits or blocks with a clear auth error and does not loop empty API
   calls.
7. Given MVP build, When exercising navigation, Then no CI mutation endpoints
   are called.

## Observability

- Info log on session start (host only, never token).
- Warn/error on API failures with status code and path template.
- Debug log for poll ticks (interval, active/idle).
- Optional future metrics: `gitlab.api.request.duration`, poll lag.
- Conventions: `doc/arch/observability/observability.md`.

## Dependencies

- GitLab REST API v4 reachable at the resolved host
- Bun toolchain for build/run
- OpenTUI packages for rendering
- Optional: glab config present for zero-config auth

## Open Questions

Resolved product decisions:

1. OpenTUI binding: **React** + TypeScript (ADR-0003).
2. Queue: **`p-queue`**, concurrency **4**, user priority **always > poll** (ADR-0002).
3. Reactive layer: **RxJS** allowed/preferred for streams into React.
4. Default project list: pins + membership fetch (not only pins).
5. Bridges/child pipelines: minimal navigation in MVP (FR-13).

## Clarifications
