---
status: accepted
date: 2026-07-14
deciders: [farchanjo]
consulted: []
informed: []
---

# ADR-0004: Project sidebar + pipeline stage board + on-demand log

## Context and Problem Statement

The 001 cockpit used four flat columns (projects | pipelines | jobs | log).
User feedback: the UI felt chaotic; navigating the project list reordered RECENT
and triggered loads every keypress; the always-visible log competed with CI
structure. The product still wants a strong **project sidebar**, but after
choosing a project the right side should feel like a **navigable pipeline
graph** (stage board), with **job output only when requested**.

## Decision Drivers

- Keep project discovery (sidebar) separate from CI structure (graph)
- Spatial mental model of stages → jobs (GitLab-like board)
- Stable j/k on project list (no recent thrash)
- Log is optional depth, not permanent chrome
- Terminal-only (OpenTUI); no real 3D engine

## Considered Options

- **A.** Keep four flat columns (status quo)
- **B.** Sidebar + pipeline stage board + on-demand log drawer (chosen)
- **C.** Full-screen pipeline only (drop sidebar until search)

## Decision Outcome

Chosen option: **B — Keep project sidebar; right zone is pipeline stage board;
job log opens only on explicit job open.**

### Layout

```text
┌ status / shortcuts ─────────────────────────────────────────┐
├ Project sidebar ┬ Pipeline graph (board) ───────────────────┤
│ smart/filter    │ [pipeline strip: #iid ref status …]       │
│ RECENT / PINNED │  build    test     deploy                 │
│                 │  [job]    [job]    [job]                  │
│                 │  [job]    [job]                           │
│                 │                                           │
│                 │  (log drawer opens only when job opened)  │
└─────────────────┴───────────────────────────────────────────┘
```

### Interaction

| Input | Effect |
|-------|--------|
| j/k in projects | cursor only; list order fixed |
| Enter on project | open project → recent update → load pipelines → board |
| h/l or arrows on board | move stage / pipeline strip |
| j/k on board | move job within stage |
| Enter on job | open log drawer + LoadTrace |
| Esc | close log, or leave board to sidebar |

### Consequences

- Good: matches user intent; fixes list thrash; log no longer dominates.
- Good: maps cleanly to existing stores (projects, pipelines, jobs, trace).
- Bad: more UI code than flat lists; stage board needs careful truncation.
- Bad: “3D” is metaphorical (layers/board), not geometric 3D.

## Relationship

- Extends 001 layout FRs; does not replace glab auth or p-queue.
- Implementation tracked in feature 002 SDD.
