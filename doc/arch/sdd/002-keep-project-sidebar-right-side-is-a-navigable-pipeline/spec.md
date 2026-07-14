---
id: 019f61dc-bcaf-79c7-963e-f6f8c113bf41
number: 002
slug: keep-project-sidebar-right-side-is-a-navigable-pipeline
status: implemented
created_at: 2026-07-14T18:20:00.000000Z
---
# Feature Specification: Pipeline graph view + stable project sidebar

Feature: 002-keep-project-sidebar-right-side-is-a-navigable-pipeline
Created: 2026-07-14
Depends on: 001 (cockpit runtime, glab auth, stores, p-queue, OpenTUI React)

## Summary

Evolve the ciview layout after project selection:

1. **Keep** the left **project sidebar** (smart/pinned/all, filter, pins, recent).
2. Replace the flat “pipelines | jobs | always-on log” triple column with a
   **pipeline graph / board view** on the right (“3D” stage board): stages as
   columns (or layered lanes), jobs as navigable cells.
3. **Job log is on demand** — only after the user explicitly opens a job
   (Enter / click). Until then the log pane is closed or collapsed.
4. **Stable navigation** — moving the cursor in the project list must **not**
   reorder RECENT or reshuffle the list; RECENT updates only on confirmed open.

Auth remains **glab only** (FR-01 from 001). Async runtime (p-queue, silent poll)
remains (ADR-0002).

## User Stories

- As a developer, I want a **spatial pipeline view** after picking a project so
  I can see stages and jobs like a board, not three stacked flat lists.
- As a developer, I want to **open job output only when I ask** so the graph
  stays readable while I browse.
- As a developer, I want the **project list to stay still** while I move with
  j/k so I can pick the project I mean.
- As an operator, I still want the **project sidebar** with pin/filter/scope.

## Functional Requirements

### Layout

1. **FR-30 Project sidebar retained.** Left sidebar behavior from 001 remains
   (scopes smart/pinned/all, multi-token filter, pins, hideable with `s`). It is
   the only entry for choosing a project.
2. **FR-31 Two-zone main layout.** After chrome/status:
   - **Zone A — Projects** (sidebar, optional hide).
   - **Zone B — Pipeline graph** (right): fills remaining width when a project
     is **opened** (confirmed).
   - **Zone C — Job log** (drawer/panel): visible **only** when a job is
     explicitly opened; otherwise hidden so the graph keeps the space.
3. **FR-32 Pipeline graph (“3D” board).** Zone B shows:
   - A **pipeline strip** (selectable list or row of recent pipelines for the
     project: iid, ref, status, short age).
   - For the active pipeline: a **stage board** — one column (or vertical lane)
     per stage in pipeline order; each cell is a job (name, status glyph,
     duration if known, allow_failure marker).
   - Empty / loading states: clear loading for user transitions; silent update
     on live poll (no loading flash) per 001 silent-refresh rules.
4. **FR-33 Graph navigation.** Focus can move:
   - among pipelines in the strip;
   - among stages (left/right or h/l);
   - among jobs within a stage (j/k);
   - Enter on a job **opens** the log (Zone C);
   - Esc closes the log (back to graph only) or moves focus up hierarchy
     (job → stage/pipeline → projects) without reordering the project list.
5. **FR-34 Job log on demand.** Opening a job enqueues LoadTrace (user
   priority) and shows Zone C with metadata + sanitized trace. Closing log
   keeps job selection for re-open but may hide Zone C. Poll may silently
   refresh an open running job’s trace without full-pane loading flash.

### Project list stability

6. **FR-35 Cursor vs open.** In the project sidebar:
   - `j`/`k` move **cursor only** (highlight). They must **not** call
     `pushRecent`, must **not** reorder the list, and must **not** enqueue
     LoadPipelines.
   - **Enter** (or explicit “open project”) **opens** the project: updates
     selection, `pushRecent`, SavePrefs, LoadPipelines (user, with loading).
7. **FR-36 Single primary highlight.** While browsing projects, one clear
   cursor highlight. Optional secondary style for “currently open project”
   (the one whose graph is shown) that does not fight the cursor.
8. **FR-37 RECENT updates only on open.** `prefs.recentProjects` changes only
   when a project is opened (Enter), not on cursor pass.

### Loading and live

9. **FR-38 Transition loading.** User open of project / pipeline / job log
   shows loading in the affected zone. Live poll remains **silent** (no status
   flip to loading).
10. **FR-39 Default pipeline.** When a project opens, auto-select the first
    (newest) pipeline and load its jobs for the graph. Changing pipeline in the
    strip reloads jobs with transition loading.

### Out of scope (002)

- True 3D graphics / OpenGL.
- Full GitLab `needs` DAG edges beyond stage columns (optional later).
- Mutating CI (retry/cancel).
- Removing the project sidebar.

## Non-Functional Requirements

1. **NFR-30 No list thrash.** Navigating j/k in the project list for 20 steps
   with a fixed RECENT set must leave item order unchanged.
2. **NFR-31 Graph readability.** Stage board must remain scannable at ≥80
   columns: truncated job names, no horizontal paint bleed into other zones.
3. **NFR-32 Spec-first.** Implementation only after this feature’s plan/tasks
   and green `speckit validate`.

## Security Requirements

- **Data sensitivity/classification.** Same as 001: pipeline/job metadata and
  job traces; traces may contain secrets — log only when user opens a job.
- **Authentication/authorization.** Unchanged: glab-only token (001 FR-01).
- **Input validation.** Unchanged; sanitize trace for terminal.
- **Cryptography in transit/at rest.** HTTPS to GitLab; no PAT in prefs.
- **Logging/audit.** Never log tokens or full traces by default.
- **Error-handling information exposure.** User-facing API errors without
  dumping private bodies by default.

## Acceptance Scenarios

1. Given the project sidebar shows RECENT, When the user presses j five times,
   Then the order of RECENT items is unchanged and no pipeline load storm
   occurs until Enter.
2. Given the user presses Enter on a project, When pipelines load, Then Zone B
   shows the stage board for the default pipeline with a loading state first.
3. Given the stage board is visible, When the user moves across stages and jobs
   without Enter on a job, Then Zone C (log) stays hidden.
4. Given focus is on a job cell, When the user presses Enter, Then Zone C opens
   and the job log loads (or shows loading then content).
5. Given Zone C is open, When the user presses Esc, Then the log closes and
   focus returns to the graph.
6. Given a running pipeline and live poll on, When poll refreshes jobs, Then the
   board updates without a loading flash.

## Observability

- User opens: project_open, pipeline_focus, job_log_open (debug, no secrets).
- Silent poll failures: queueMeta lastError only.
- Conventions: `doc/arch/observability/observability.md`.

## Open Questions (resolved for plan)

1. “3D” means **stage board / layered graph in the terminal**, not WebGL.
2. Log is a **slide-over or bottom/right drawer**, not a permanent fourth column.
3. Project open = **Enter** (not hover/cursor).

## Clarifications
