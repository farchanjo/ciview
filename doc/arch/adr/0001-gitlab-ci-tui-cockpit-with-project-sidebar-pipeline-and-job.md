---
status: accepted
date: 2026-07-14
deciders: [farchanjo]
consulted: []
informed: []
---

# ADR-0001: Bun + OpenTUI GitLab CI cockpit (ciview)

## Context and Problem Statement

Developers and operators need a fast way to navigate GitLab CI (projects,
pipelines, jobs, logs) in the terminal. `glab` exposes useful CLI commands but
not a multi-pane, live, multi-project cockpit. Browser UI is rich but slow to
context-switch. We need a dedicated **CI-only** TUI with clear visualization
and keyboard navigation.

## Decision Drivers

- CI-only product focus (no full GitLab client)
- Rich terminal UI with reactive updates (live poll)
- TypeScript ergonomics and modern package tooling
- Reuse existing glab credentials on developer machines
- Self-hosted GitLab compatibility (REST API v4)

## Considered Options

- **A.** Bun + TypeScript + OpenTUI + thin GitLab REST client (chosen)
- **B.** Go + Bubble Tea / Charm stack calling GitLab API
- **C.** Thin wrapper scripts around `glab` with a minimal TUI
- **D.** Web local dashboard (localhost) instead of TUI

## Decision Outcome

Chosen option: **A — Bun + OpenTUI + GitLab REST**, because it matches the
desired stack, enables a reactive multi-pane cockpit, and talks to the same API
already validated against the target self-hosted GitLab. Auth bootstraps from
glab/env rather than re-implementing login.

UI binding is fixed to **React + TypeScript** (see ADR-0003). Async I/O uses
**`p-queue` concurrency 4** with user priority over poll (see ADR-0002).

### Consequences

- Good: Single language (TS) for UI and API; OpenTUI suited to frequent redraws;
  independent of glab release cadence for the render loop; CI-only scope stays
  enforceable in the TUI information architecture.
- Good: Lazy master–detail loading maps cleanly to REST endpoints.
- Bad: OpenTUI is younger than Bubble Tea/Ink; API churn risk — mitigate by
  isolating UI toolkit behind thin view modules.
- Bad: Bun-specific tooling may surprise contributors on Node-only setups —
  document Bun as required runtime.
- Bad: Job traces can be huge — must virtualize/tail rather than load entire
  logs into memory by default.
