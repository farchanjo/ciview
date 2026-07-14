# ciview Constitution

Foundational principles for **ciview** (Bun + OpenTUI GitLab CI TUI).

## Summary

| ID | Principle | Rule | Blocks | Related |
|---|---|---|---|---|
| P1 | CI-only product | Pipelines/jobs/logs only | Issues/MR/registry hub | `doc/arch/functional/product-overview.md` |
| P2 | Spec-first | `doc/arch` > code | Impl without feature phase | SDD |
| P3 | Terminal board UX | Sidebar + stage board; log on demand | Always-on 4-column thrash | ADR-0004 |
| P4 | Read-mostly MVP | View/nav/log/open only | Retry/cancel without feature | security |
| P5 | glab-only auth | Token/host from glab; exit `2` if missing | Env PAT primary path | FR-01 |
| P6 | Lazy load | Master–detail fetches | Full-org fan-out | performance |
| P7 | Live when open | Poll open project (incl. idle strip for new pipelines) | Poll with no project / live off | FR-08b |
| P8 | Bun+React OpenTUI | `src/ciview/**` TypeScript | Solid/Ink primary | ADR-0003 |
| P9 | English corpus | Specs/ADRs English | Mixed corpus | AGENTS.md |
| P10 | No secrets in tree | No PAT in git | Token dumps | privacy |
| P11 | Async p-queue | Concurrency `4`; user > poll | Sync HTTP in keys | ADR-0002 |
| P12 | Shell-safe exit | FR-27 ordered teardown; parent shell usable | `process.exit` mid-destroy | `shutdown-flow.md` |

## Principles

### P1 — CI-only product

In: projects sidebar, pipelines, stages, jobs, traces, pins, filters, `web_url` open.  
Out: issues, MR authoring, source browser, registry admin, editing `.gitlab-ci.yml`.

### P2 — Spec-first

`speckit status` → `speckit next` → phase. `speckit validate` / `speckit verify` green before commit.

### P3 — Terminal board UX

Left: project sidebar. Right: pipeline strip + stage board. Job log drawer only after Enter on job. Cursor ≠ open (FR-35).

### P4 — Read-mostly MVP

No retry/cancel/play until a dedicated feature.

### P5 — glab-only auth

`glab` on `PATH` + config token. Missing install/login steps on stderr; exit code `2`.

### P6 — Lazy load

Load pipelines on openProject; jobs on pipeline change; trace on openJobLog.

### P7 — Live when project open

`RefreshVisible` silent (`band=poll`); no loading flash. While live + project
open, re-fetch pipelines even if CI is idle so new pipelines appear (FR-08b);
do not auto-switch the selected pipeline.

### P8 — Bun + React OpenTUI

Runtime Bun; UI `@opentui/react`; client `src/ciview/gitlab/client.ts`.

### P9 — English corpus

Committed specs English.

### P10 — No secrets in tree

`.env` gitignored; never log `PRIVATE-TOKEN`.

### P11 — Async queue runtime

`p-queue` concurrency `4`; priorities user=`20` poll=`10` idle=`5`.

### P12 — Shell-safe process exit

`q` / Ctrl+C / catchable signals: cleanup → full OpenTUI destroy →
`restoreTerminalTty` → `exit 0`. Never `process.exit` on mid-cycle `"destroy"`.
Parent shell must remain usable (no Kitty CSI-u noise, no alt-screen residue).
Normative: feature 001 FR-27 + `shutdown-flow.md`.

## Production / quality gates (MVP)

| Gate | Evidence |
|---|---|
| G1 | `speckit validate` exit `0` |
| G2 | `bun test` + `tsc --noEmit` |
| G3 | glab auth resolves |
| G4 | `speckit verify` scenarios pass |
| G5 | FR-27 unit tests (`shutdown` + `terminalRestore`) green |

## Governance

| Rule | Detail |
|---|---|
| MADR | Constitution/stack changes need ADR under `doc/arch/adr/` |
| Scope | New surfaces need a feature under `doc/arch/sdd/` |
| Agent map | `AGENTS.md` path-anchored |
