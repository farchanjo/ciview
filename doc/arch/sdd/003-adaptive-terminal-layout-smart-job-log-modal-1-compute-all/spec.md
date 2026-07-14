---
id: 019f621d-7aa8-7e31-90ec-519d602f605c
number: 003
slug: adaptive-terminal-layout-smart-job-log-modal-1-compute-all
status: implemented
created_at: 2026-07-14T19:32:06.952255Z
---
# Feature Specification: Adaptive terminal layout + smart job-log modal

Feature: 003-adaptive-terminal-layout-smart-job-log-modal-1-compute-all
Created: 2026-07-14
Depends on: 001 (runtime, glab, stores, p-queue), 002 (sidebar + stage board + on-demand log)

## Summary

Make the ciview TUI **geometry-aware** and replace the flex-attached job-log
drawer with a **smart full-viewport modal**:

1. **Single layout engine** — pure functions compute all pane sizes, densities,
   and modal metrics from live `termWidth` × `termHeight` (short, tall, narrow,
   wide, fullscreen and windowed terminals).
2. **No overflow / paint bleed** — parent flex children never claim `height: 100%`
   while a sibling also needs fixed rows; sidebar, strip, board, help, and log
   modal each receive a budget that fits the terminal.
3. **Smart job log** — absolute overlay modal (does not reflow the board);
   classify lines (error/warn/section/ok/noise); modes `smart` | `errors` |
   `all`; jump to errors; visible line count derived from modal height.
4. **Preserve 002 focus model** — projects / pipeline_strip / stage_board /
   job_log; Enter opens log; Esc closes log; cursor ≠ open (FR-35).

Auth, p-queue, silent poll, and glab-only auth remain unchanged.

## User Stories

- As a developer on a **short laptop terminal** (e.g. 24 rows), I want the board
  and status to still fit so I can navigate stages without clipped columns.
- As a developer on a **tall/fullscreen terminal**, I want the job log modal to
  use most of the height so I can read stack traces without constant scrolling.
- As a developer debugging a **failed job**, I want the log to open already
  parked on the first hard error, with noise collapsed, so I find the failure
  faster.
- As a developer, I want to **cycle log density** (smart / errors-only / full)
  and jump next/prev error without leaving the keyboard.

## Functional Requirements

### Adaptive geometry (layout engine)

1. **FR-40 Terminal metrics.** UI chrome tracks both `termWidth` and
   `termHeight` on start and on terminal `resize`. Values are positive integers;
   when unknown, safe defaults (`120×40`) apply.
2. **FR-41 Layout budget API.** A pure module (e.g. `util/layoutBudget.ts` or
   equivalent) accepts `{ termWidth, termHeight, sidebarVisible, logOpen,
   helpOpen, stageCount }` and returns a **LayoutBudget** value object:
   - `statusRows`, `sidebarWidth`, `sidebarVisibleEffective`
   - `stripRows`, `stageColWidth`, `boardMinHeight`
   - `logModal`: `{ left, top, widthPct or cols, heightPct or rows, contentRows,
     maxLineCols, chromeRows }`
   - `helpModal`: size/position scaled similarly
   - optional `density`: `compact` | `normal` | `comfortable` from height tiers
3. **FR-42 Width breakpoints.**
   - Width `< 100`: auto-collapse sidebar unless user forced show (`]` / force).
   - Stage column width scales with remaining width and stage count (min ≥ 10,
     max ≤ 22, never overflow usable width).
   - Sidebar width scales: narrow terminals use fewer columns (e.g. 22–26);
     wide can use 28–32 — always ≤ 30% of width and ≥ 18 when visible.
4. **FR-43 Height breakpoints.**
   - Height `< 20`: compact density — status exactly 1 row, strip ≤ 2,
     log modal contentRows ≥ 6.
   - Height `20–34`: normal — strip 2–3, log contentRows from ~90% height minus
     modal chrome.
   - Height `≥ 35`: comfortable — strip up to 5, log contentRows large.
   - Never request more rows than `termHeight` for any stacked chrome.
5. **FR-44 No flex overflow.** Job log **must not** sit as a flex sibling of
   `PipelineGraph` with fixed height while the graph also has `height: 100%`.
   Log is an **absolute overlay** (or equivalent non-flowing layer) so the board
   layout is stable with log open or closed.
6. **FR-45 Resize recompute.** On resize, recompute budget; clamp
   `logScrollFromBottom` to the new view length; do not reset focus or
   `logMode` unless the log is closed.

### Smart job-log modal

7. **FR-46 Modal log.** Enter on a job opens Zone C as a modal overlay covering
   most of the terminal (budget-driven size). Esc closes and returns focus to
   `stage_board` (or pops child pipeline first when stack non-empty — 002).
8. **FR-47 Log modes.** `logMode`: `smart` (default) | `errors` | `all`.
   - `smart`: keep errors, warns, CI sections, ±context, and a short tail;
     collapse other ranges into ellipsis rows.
   - `errors`: only error and warn lines.
   - `all`: full sanitized trace (still ANSI-stripped for classification
     display).
   Key `e` cycles smart → errors → all → smart while log is open.
9. **FR-48 Classification.** Pure classifier tags lines: `error` | `warn` |
   `section` | `ok` | `info` | `noise` (GitLab section markers, common CI
   failure patterns). Display uses stable colors/glyphs; never logs full trace
   to disk.
10. **FR-49 Error navigation.** `n` / `N` jump next/previous hard error in the
    current view; highlight the active error hit. On first user LoadTrace ready
    in smart/errors mode, **park viewport on first error** when any exist;
    otherwise follow bottom when follow is on.
11. **FR-50 Log scrolling.** j/k line scroll; **PgUp / PgDn** full-page
    (one `contentRows` viewport); Space / Ctrl+d half-page down; b /
    Ctrl+u half-page up; g top; G end+follow; f toggles follow. Scroll uses
    **view-line** count from the active mode and `contentRows` from budget.
12. **FR-51 Trace window.** Store still caps sanitized tail (e.g. last 2000
    lines) for memory; modal never paints more than `contentRows` at once.

### Compatibility

13. **FR-52 Focus model preserved.** Tab cycle and panes from 002 remain;
    while log modal is open, log keys take priority until Esc.
14. **FR-53 No CI mutations / no auth change.** Read-only; glab-only; silent
    poll unchanged.

## Non-Functional Requirements

1. **NFR-40 Fit.** At 80×24 and 120×40 and 200×60, open project + stage board
   paints without sibling overflow corruption (no paint bleed into sidebar).
2. **NFR-41 Pure budget.** LayoutBudget functions are unit-tested pure (no
   OpenTUI / no DOM); same inputs → same outputs.
3. **NFR-42 Spec-first.** Implementation only after this feature’s plan/tasks
   and green `speckit analyze` / `speckit validate`.
4. **NFR-43 Performance.** Classification of ≤2000 lines is sync and
   sub-frame for interactive keying on typical machines.

## Security Requirements

- **Data sensitivity/classification.** Job traces may contain secrets or PII
  from CI output. This feature only displays sanitized traces already fetched
  under 001/002 on-demand open; it does not widen fetch scope.
- **Authentication/authorization.** Not applicable — no new auth surface;
  remains glab-only (001 FR-01).
- **Input validation.** Trace text is untrusted CI output: sanitize control
  chars (existing), strip ANSI for classification, bound stored lines (tail
  cap), bound painted columns to budget `maxLineCols`.
- **Cryptography in transit/at rest.** Not applicable — HTTPS to GitLab
  unchanged; no new persistence of traces.
- **Logging/audit.** Never log full traces or tokens; optional debug counters
  only (open_job_log) without line bodies.
- **Error-handling information exposure.** API/load errors show short
  user-facing messages (existing pattern); no response body dump.

## Acceptance Scenarios

1. Given a terminal of 80×24 with a project open and sidebar auto-hidden,
   When the stage board paints, Then stage columns fit the usable width and
   status+strip+board rows do not exceed terminal height.
2. Given any terminal size, When the user opens a job log, Then the board
   layout under the modal does not reflow or corrupt, and the modal size comes
   from LayoutBudget for that size.
3. Given a failed job trace with a hard error, When LoadTrace completes with
   logMode=smart, Then the viewport parks near the first error and smart view
   may show ellipsis for omitted noise.
4. Given the log modal open, When the user presses `e`, Then mode cycles
   smart→errors→all and the visible rows recompute from the new view.
5. Given multiple errors in the view, When the user presses `n` then `N`,
   Then focus moves next then previous error with scroll adjustment.
6. Given the log modal open, When the user presses Esc, Then the modal closes
   and focus returns to stage_board (unless child pipeline stack pops first).
7. Given a resize while log is open, When termWidth/termHeight change, Then
   contentRows and maxLineCols update and scroll is clamped without crashing.

## Observability

- Counter/event: `ciview.ui.open_job_log` (existing) — no trace body labels.
- Optional debug: layout density tier on resize (no PII).
- Conventions: `doc/arch/observability/observability.md`.
- No OTLP requirement beyond existing product stance for MVP.

## Relationship

- Extends 002 Zone C (on-demand log) from drawer-in-flex to modal overlay.
- Extends 002 FR-12 responsive collapse with full height-aware budget.
- Does not replace 001 runtime or auth.

## Clarifications
