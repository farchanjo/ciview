---
id: 019f61b4-089c-7961-a6e5-d83244cb7931
number: 001
slug: gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job
status: analyzed
created_at: 2026-07-14T17:36:56.476546Z
---
# Feature Specification: GitLab CI TUI Cockpit

Feature: 001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job
Created: 2026-07-14

## Summary

Ship **ciview**, a Bun + OpenTUI terminal application that provides a
multi-pane, keyboard-first GitLab CI navigator: project sidebar → pipelines →
stages/jobs → job detail and log. Read-mostly MVP with live polling while CI is
active. Auth reuses glab config or standard GitLab environment variables.
Runtime is **async-first on Bun**: job queue, async workers, store observers
(ADR-0002) — the UI never blocks on HTTP.

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

1. **FR-01 Auth bootstrap.** On start, resolve GitLab base URL and token from
   `GITLAB_TOKEN` + `GITLAB_HOST`/`GITLAB_URL` (or equivalent), else from glab
   CLI config. If unresolved, show a clear error and exit non-zero without
   calling the API with an empty token.
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
7. **FR-07 Keyboard navigation.** Support panel focus, move within panel,
   Enter to drill down, Esc/Back to go up, filter, manual refresh, open in
   browser, quit. A visible key legend or status bar documents the essentials.
8. **FR-08 Live poll.** While any visible/selected pipeline or job is in an
   active state (`created`, `pending`, `running`, `waiting_for_resource`, or
   equivalent GitLab active set), refresh on a configurable short interval
   (default 3s). When idle, back off or stop automatic poll until refresh/focus.
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
16. **FR-16 Async workers.** A bounded pool of async workers (same Bun process /
    event loop) consumes the queue, executes handlers, and applies success or
    error results to the store. Default MVP does **not** require OS `Worker`
    threads.
17. **FR-17 Store observers.** The TUI updates exclusively by observing store
    changes (subscribe/notify). Job handlers must not call terminal paint APIs.
18. **FR-18 Stale-job safety.** On project/pipeline/job selection change, in-flight
    jobs for the previous selection are aborted or their results discarded
    (generation token and/or `AbortController`) so a slow response cannot
    overwrite newer pane data.
19. **FR-19 Job coalescing.** Duplicate jobs of the same kind and resource key
    while one is queued or running are coalesced (no stampede on rapid key
    repeat or poll overlap).

## Non-Functional Requirements

1. **NFR-01 Stack.** Bun runtime; TypeScript; OpenTUI for the TUI; thin GitLab
   REST v4 client; async queue + workers + observers (ADR-0002).
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

Resolved defaults for planning (confirm or override in clarify):

1. OpenTUI binding: prefer **Solid** reconcilers if first-class; else React —
   decide in plan based on package maturity.
2. Default project list: pins + recent with membership fetch (not only pins).
3. Bridges/child pipelines: include minimal navigation in MVP (FR-13).

## Clarifications
