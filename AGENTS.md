# ciview — Agent Context

Canonical, machine-readable map of this repository for AI agents and
automation. Keep this file dense, factual, and path-anchored; prefer exact
paths over prose.

Prune as you go: when the code moves on, refresh what drifted and delete dead
sections and stale path references — keep this file lean, do not only append to
it.

## Project

**ciview** is a terminal CI cockpit for GitLab: multi-pane OpenTUI navigator for
projects → pipelines → stages/jobs → logs. Stack: **Bun**, **TypeScript**,
**OpenTUI**, GitLab REST API v4. Auth reuses **glab** config / `GITLAB_*` env.

Spec-driven with **speckit**. Source of truth: `doc/arch`. Code follows specs.

## Architecture

```
doc/arch/
├── memory/constitution.md    # product principles (CI-only, Bun+OpenTUI, …)
├── functional/               # product overview and flows
├── adr/                      # MADR architecture decision records
├── schemas/                  # CUE schemas (as added)
├── specs/features/           # Gherkin feature specifications
├── architecture/             # C4 / Structurizr (as added)
├── sdd/                      # per-feature working dirs (NNN-slug)
├── observability/
├── quality/
├── threat-model/
├── runbooks/
└── speckit.toml              # guard + project config
```

Implementation (when present): `src/**` (Bun/TS + OpenTUI). User preferences
(pins, poll interval; not secrets) persist under the operator XDG config home
in an application-private file (see feature plan prefs module). Secrets come
from process environment or the operator glab CLI configuration — never from
the git tree.

## Commands

```
bun install           # install deps
bun run check         # typecheck + tests (once package scripts exist)
bun run build         # build distributable
bun run start         # run TUI (once entry exists)
speckit status        # active feature + phase
speckit next          # recommended next command
speckit validate      # validate doc/arch corpus (must be 0 findings before commit)
speckit verify        # Gherkin corpus against binary when present
```

## Conventions

- Guard (`[guard]` in `doc/arch/speckit.toml`) limits writes; never bypass with
  `--allow-out-of-spec` to force product code — fix scope or plan.
- Workflow: constitution → specify → clarify → plan → tasks → analyze →
  implement → validate.
- English for committed specs and agent maps.
- CI-only product surface; MVP is read-mostly (no retry/cancel until specified).
- Lazy GitLab API loads; poll fast only while pipelines/jobs are active.
- **Async runtime (Bun, ADR-0002):** queue + async workers + store observers.
  UI dispatches intents only; GitLab HTTP lives in job handlers; no OS `Worker`
  threads in MVP.

## Spec-first protocol

- Before work: `speckit status` then `speckit next`; do that step only.
- `speckit validate` green before every commit.
- Source of truth: `doc/arch` — spec > code > assumption.
- Never edit `doc/.specify/*` databases by hand.
- Red validate → fix the artifact, never the rule.

### Git workflow

- Angular Conventional Commits: `<type>(<scope>): <subject>` (header ≤72 chars).
- Never bypass speckit gates to force a commit.
- Never add AI attribution trailers or “generated with” notices to commits/docs.
