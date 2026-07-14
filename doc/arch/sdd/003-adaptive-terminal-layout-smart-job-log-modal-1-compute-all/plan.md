# Implementation Plan: Feature 003 — Adaptive layout + smart job-log modal

## Overview

Implement FR-40…FR-53 on top of the 001/002 runtime. **No further product
behavior beyond this plan until tasks are ordered and `speckit analyze` is
green.** Partial smart-log code may already exist under `src/ciview/`; this
plan **normalizes** it behind a pure `LayoutBudget` and completes adaptive
geometry for sidebar, strip, board, help, and log modal.

## Goals

1. Pure **LayoutBudget** from `termWidth` × `termHeight` (+ flags).
2. All major panes consume budget (no stray magic sizes for density).
3. Job log as **absolute modal** (never flex sibling of graph).
4. Smart log modes + error jump + park-on-error (already sketched) wired to budget `contentRows`.
5. Unit tests for budget at 80×24, 120×40, 200×60; log scroll clamps.

## Non-goals

- Real 3D / WebGL
- External pager
- CI mutations
- Changing glab auth or p-queue concurrency

## Technical Approach

### Layers (hexagonal-ish SDD mapping)

| Layer | Path | Role |
|-------|------|------|
| Domain pure | `src/ciview/util/layoutBudget.ts` | LayoutBudget VO + density tiers |
| Domain pure | `src/ciview/util/smartLog.ts` | classify + buildLogView |
| Application | `src/ciview/util/logNav.ts` | scroll/jump/park using budget contentRows |
| State | `src/ciview/state/root.ts` | termW/H, logMode, logErrorCursor, logOpen |
| UI adapters | `ui/panes/*`, `App.tsx`, `HelpOverlay.tsx` | paint only; read budget |
| Runtime | `handlers.ts` LoadTrace | parkLogOnFirstError on user load |

Handlers/queue never call paint APIs (ADR-0002).

### LayoutBudget shape

```ts
type Density = "compact" | "normal" | "comfortable";
type LayoutBudget = {
  termWidth: number;
  termHeight: number;
  density: Density;
  statusRows: number;
  sidebarVisibleEffective: boolean;
  sidebarWidth: number;
  stripRows: number;
  stageColWidth: number;
  logModal: ModalBox;
  helpModal: ModalBox;
};
// computeLayoutBudget(input) pure
```

### UI consumption

- `App.tsx`: track termW/H; render `JobLogDrawer` as overlay sibling (not under graph flex).
- `ProjectSidebar`: `width: budget.sidebarWidth`, height fill.
- `PipelineGraph`: strip height from `stripRows`; col width from budget; **no** `height:100%` fight with log.
- `JobLogDrawer`: position/size from `logModal`; `logVisibleLines` → `budget.logModal.contentRows`.
- `HelpOverlay`: size from `helpModal`.

### Navigation (log open)

See `keybindings.md`. Priority capture while `logOpen`.

### Tests

- `layoutBudget.test.ts`: tiers, fit invariants (rows ≤ termHeight, cols ≤ termWidth).
- `smartLog.test.ts` / `layout.test.ts`: scroll, jump, park, mode cycle.
- Manual: `bun run start` short + tall terminal.

## Task phases

1. Spec/docs (this feature) — in progress via lifecycle
2. LayoutBudget pure module + tests
3. Wire UI consumers (sidebar, graph, help, status)
4. Modal log + smart nav fully on budget
5. Gates: validate, verify, bun test, tsc

## Success criteria

- FR-40…FR-53 satisfied
- NFR-40: 80×24 / 120×40 / 200×60 no overflow
- `speckit validate` 0; `bun test` + `tsc` green
- Gherkin scenarios documented and unit-backed where automatable

## Companion artifacts

- `ux-layout.md`, `keybindings.md` (this feature dir)
- CUE: `doc/arch/schemas/adaptive-terminal-layout-smart-job-log-modal-1-compute-all.cue`
- Gherkin: `doc/arch/specs/features/adaptive-terminal-layout-smart-job-log-modal-1-compute-all.feature`
- ADR-0005
