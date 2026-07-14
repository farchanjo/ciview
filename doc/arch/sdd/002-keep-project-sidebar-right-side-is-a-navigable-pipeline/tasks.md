# Tasks: Feature 002 — Pipeline stage board

## Task Breakdown

### Spec / gates

- [x] T001 Write feature 002 spec (FR-30…FR-39), ADR-0004, Gherkin, CUE, ux-layout.
- [x] T002 `speckit analyze` + `speckit validate` green before any UI rewrite.

### Stable project navigation

- [x] T003 Project `j`/`k` / jump: **cursor only** — no selectProject/pushRecent/LoadPipelines.
- [x] T004 Project `Enter`: `openProject(id)` — selection, pushRecent, SavePrefs, LoadPipelines, focus graph.
- [x] T005 Unit tests: RECENT order / cursor independent of selection.
- [x] T006 Distinct styles: cursor (blue bg) vs open project (● cyan).

### Pipeline graph UI

- [x] T007 Chrome: `logOpen`, `board` cursors, PaneId graph zones.
- [x] T008 `PipelineGraph` (strip + stage columns).
- [x] T009 Stage/job keyboard (h/l, j/k) without opening log.
- [x] T010 Pipeline strip change loads jobs with transition loading; poll silent.
- [x] T011 Default newest pipeline on openProject (handler auto-select).

### On-demand log

- [x] T012 `JobLogDrawer` only when `logOpen`.
- [x] T013 Enter job → openJobLog + LoadTrace; Esc → closeJobLog.
- [x] T014 Removed always-visible DetailLog / JobTree / PipelineList columns.

### Integration / polish

- [x] T015 Layout: sidebar | graph | optional drawer.
- [x] T016 keybindings + Help table (keys.ts).
- [x] T017 product-overview + constitution aligned (done in spec phase).
- [x] T018 Manual smoke: user validates in terminal (`bun run start`).
- [x] T019 `bun test`, `tsc`, `speckit validate` green.

## Order

Completed T001→T019.
