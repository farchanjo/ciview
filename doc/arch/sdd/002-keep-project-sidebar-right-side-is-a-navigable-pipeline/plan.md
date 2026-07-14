# Implementation Plan: Feature 002 — Pipeline stage board

## Overview

Implement the layout and interaction from `spec.md` and `ux-layout.md` on top
of the 001 runtime (`src/ciview/`). **No product code until this plan’s tasks
are accepted and analyze is green.**

## Goals

1. Stable project sidebar navigation (cursor ≠ open).
2. Right zone = pipeline strip + **stage board**.
3. Job log drawer only when job is explicitly opened.
4. Keep glab auth, p-queue, silent poll, stores.

## Non-goals

- WebGL / real 3D
- Full `needs` edge drawing
- CI mutations

## Technical Approach

### Layout components (`src/ciview/ui/`)

| Component | Role |
|-----------|------|
| `ProjectSidebar` | Keep; remove duplicate chrome noise if needed |
| `PipelineGraph.tsx` | Zone B: strip + stage board |
| `StageColumn.tsx` | One stage’s jobs |
| `JobLogDrawer.tsx` | Zone C: only if `chrome.logOpen` |
| Remove as primary | Permanent 4-column PipelineList \| JobTree \| DetailLog always visible |

### Chrome state extensions (`uiChromeStore`)

```ts
graphFocus: 'projects' | 'pipeline_strip' | 'stage_board' | 'job_log'
logOpen: boolean
board: { pipelineIndex, stageIndex, jobIndex }
// open project = selection.projectId after Enter open
// projectCursor independent
```

### Navigation rules

```
projects j/k     → cursor only (NO selectProject, NO pushRecent, NO LoadPipelines)
projects Enter   → openProject(): selection + pushRecent + LoadPipelines + focus strip/board
board h/l        → stageIndex
board j/k        → jobIndex within stage
board Enter      → logOpen=true + selectJob + LoadTrace
log Esc          → logOpen=false, graphFocus=stage_board
```

### Effects change

- Selection subscription for pipelines: only when `projectId` changes from
  **open** path (not from cursor-only). Prefer explicit `openProject` intent
  rather than selection-on-every-j/k.
- Optional: keep selection.projectId only for open project; cursor is
  `projectCursor` into flat list only.

### Loading

- openProject / change pipeline / open log → non-silent loads
- RefreshVisible → silent (unchanged)

### Tests

- Unit: openProject updates recent; moveCursor does not.
- Unit: stage board cursor bounds.
- Manual: no list thrash; log only on Enter job.

## Task phases

1. Spec/docs (this feature) — done in SDD
2. Fix project cursor vs open + recent
3. PipelineGraph + StageColumn UI
4. JobLogDrawer gated by logOpen
5. Wire keys; strip always-on triple column
6. Tests + validate

## Success criteria

- FR-30…FR-39 satisfied
- Gherkin scenarios automatable or manual-checked
- `speckit validate` 0 findings
- No RECENT reorder on j/k (NFR-30)
