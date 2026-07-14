# Tasks: Feature 003 — Adaptive layout + smart job-log modal

## Task Breakdown

### Spec / gates

- [x] T001 Write feature 003 `spec.md` (FR-40…FR-53), ADR-0005, CUE, Gherkin, ux-layout, keybindings, plan.
- [x] T002 `speckit analyze` + `speckit validate` green before layout rewrite finishes.

### LayoutBudget (pure)

- [x] T003 Add `src/ciview/util/layoutBudget.ts`: `computeLayoutBudget(input) → LayoutBudget` with density tiers, sidebar width, stripRows, stageColWidth, logModal, helpModal.
- [x] T004 Unit tests `layoutBudget.test.ts`: 80×24, 120×40, 200×60 invariants (rows fit height, cols fit width, contentRows ≥ 6, stageColWidth ≥ 10).
- [x] T005 Export helpers used by log nav: `budgetLogContentRows`, `logPageStep` (budget fields).

### Chrome state + resize

- [x] T006 Ensure `UiChromeState` has `termWidth`, `termHeight`, `logMode`, `logErrorCursor`, `logOpen` (align with CUE `#LogChrome`).
- [x] T007 `App.tsx` resize sync updates both width and height; recompute consumers on change; clamp log scroll on resize.

### Wire board consumers

- [x] T008 `ProjectSidebar` width from `budget.sidebarWidth` (not hard-coded 30 only).
- [x] T009 `PipelineGraph` strip rows + stageColWidth from budget; remove height-100% conflict with log.
- [x] T010 `StatusBar` height respects `budget.statusRows` when density compact.
- [x] T011 `HelpOverlay` size/position from `budget.helpModal`.

### Smart log modal

- [x] T012 `JobLogDrawer` absolute overlay only (outside graph flex); geometry from `budget.logModal`.
- [x] T013 Smart log: modes smart/errors/all, classify, ellipsis, park on first error (`smartLog` + `logNav`).
- [x] T014 Log keys while open: j/k, n/N, e, g/G, f, Space/b, Esc; page size from budget.
- [x] T015 LoadTrace user path calls `parkLogOnFirstError`; silent poll only follows when follow on.
- [x] T016 Trace tail cap ≥ 2000 sanitized lines; paint at most `contentRows`.

### Integration / polish

- [x] T017 Update Help `keys.ts` + STATUS_HINT for log modal shortcuts.
- [x] T018 Align constitution / product-overview phrasing: log modal + adaptive budget (ADR-0005).
- [x] T019 `bun test`, `tsc --noEmit`, `speckit validate` green.
- [x] T020 Manual smoke: short terminal + tall terminal (`bun run start`) — operator verifies in terminal.

## Order

Completed T001→T020 (T020 operator smoke optional in CI).

## Dependencies

- Features 001 and 002 implemented (runtime, board, openJobLog).
- OpenTUI absolute positioning for overlays (HelpOverlay pattern).
