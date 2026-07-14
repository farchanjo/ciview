---
status: accepted
date: 2026-07-14
deciders: [farchanjo]
consulted: []
informed: []
---

# ADR-0005: Adaptive layout budget + smart job-log modal

## Context and Problem Statement

Feature 002 placed the job log as a **flex sibling** under the pipeline graph
with a fixed height. On many terminal sizes that overflowed the parent
(`height: 100%` graph + fixed drawer), corrupting the whole TUI (paint bleed,
garbled sidebar). Users also need the log to scale from short (24-row) to
tall/fullscreen sessions, and failed jobs need **smart** scanning (errors
first), not only a raw tail.

## Decision Drivers

- Terminals vary widely (80×24 laptop, tiling WM panes, fullscreen)
- OpenTUI flex overflow is catastrophic (full-frame corruption)
- Failed CI logs are long and noisy; failures must surface quickly
- Keep 002 mental model (sidebar + board + on-demand log)
- Pure, testable geometry (no paint APIs in layout math)

## Considered Options

- **A.** Keep flex drawer; only reduce fixed height — still fights `height:100%`
- **B.** Absolute full-viewport log modal + pure LayoutBudget for all chrome
  (chosen)
- **C.** Separate full-screen route (drop board while log open) — loses context
- **D.** External pager (`less`) — leaves the product and loses live follow

## Decision Outcome

Chosen option: **B — pure LayoutBudget from termWidth×termHeight; job log is
an absolute modal overlay; smart/errors/all classification and error jump.**

### Geometry

```text
termWidth × termHeight
        │
        ▼
  LayoutBudget (pure)
   ├─ statusRows, sidebarWidth, sidebarVisibleEffective
   ├─ stripRows, stageColWidth, density
   ├─ logModal { origin, size, contentRows, maxLineCols }
   └─ helpModal { … }
        │
        ▼
  OpenTUI panes consume budget only (no ad-hoc magic numbers in JSX)
```

### Log modal

- Rendered outside the main flex row/column that owns sidebar+graph
- `position: absolute` (or OpenTUI equivalent), high z-index, opaque background
- Default mode `smart`; park on first error after user LoadTrace
- Keys: j/k, n/N, e, g/G, f, Space/b, Esc (see feature keybindings)

### Consequences

- Good: board layout stable with log open/closed; works on short and tall TTYs
- Good: layout math unit-testable; UI becomes a thin consumer
- Good: faster failure triage via classification + jump
- Bad: slightly more code than a fixed drawer
- Bad: classifier heuristics may false-positive; mode `all` remains escape hatch

## Relationship

- Supersedes 002 “drawer under graph” presentation for Zone C only
- Does not change glab auth, p-queue, or openProject semantics
- Implementation: feature 003 SDD
