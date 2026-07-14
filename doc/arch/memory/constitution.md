# ciview Constitution

Foundational principles for **ciview**: a terminal CI cockpit for GitLab,
built with Bun and OpenTUI. This document bounds scope, stack, and evolution.

## Summary

| ID | Principle | Rule | Blocks | Related |
|---|---|---|---|---|
| P1 | CI-only product | Scope is GitLab pipelines, jobs, builds, and logs only | Issues, MRs as first-class, code browse, registry, generic project hub | product-overview |
| P2 | Spec-first | `doc/arch` is source of truth; code follows validated specs | Implementation without active feature phase | SDD loop |
| P3 | Terminal-first UX | Primary UI is an OpenTUI multi-pane cockpit; keyboard is the main input | Web UI or GUI as MVP | OpenTUI layout |
| P4 | Read-mostly MVP | First ship is navigate + visualize + live poll + open-in-browser | Retry/cancel/write CI actions until an explicit feature | security |
| P5 | Reuse glab auth | Host and token come from glab config / standard GitLab env; no parallel secret store | Inventing a second credential UX | auth |
| P6 | Lazy API load | Master–detail: load pipelines for selected project, jobs for selected pipeline, trace for selected job | Eager full-org fan-out on every tick | performance |
| P7 | Live when needed | Fast poll only while visible context is `running`/`pending`; idle slows or pauses | Always-on aggressive polling | observability |
| P8 | Bun + OpenTUI stack | Runtime Bun; UI OpenTUI (TypeScript); GitLab REST via thin client | Node-only toolchain, Ink/Blessed as primary UI, heavy frameworks | stack |
| P9 | English corpus | All committed specs, ADRs, and agent maps are English | Mixed-language corpus drift | AGENTS.md |
| P10 | No secrets in tree | Tokens never committed; `.env` gitignored; logs must not echo credentials | PAT in repo, debug dumps of Authorization headers | privacy |
| P11 | Async queue runtime | All GitLab/disk side effects go through Bun async job queue + workers; UI updates via store observers only | Sync HTTP in key handlers; fetch code calling paint; OS workers for every request in MVP | ADR-0002 |

## Principles

### P1 — CI-only product

ciview is a **GitLab CI navigator**, not a GitLab desktop client.

**In scope:** project sidebar (as entry to CI), pipelines, stages, jobs, job
detail, job logs/trace, status visualization, live refresh, open `web_url` in
browser, pins/favorites, filters (ref/status/path).

**Out of scope (unless a future feature explicitly expands):** issue tracker,
merge-request editing, source browser, package/container registry admin,
runner fleet admin, editing `.gitlab-ci.yml`, multi-product “forge” features.

### P2 — Spec-first

Behavioral change starts under `doc/arch` (specify → clarify → plan → tasks →
implement → validate). `speckit validate` must be green before commit. Never
bypass the guard to force code through.

### P3 — Terminal-first UX

Default experience: multi-column TUI (projects → pipelines → jobs/stages →
detail/log). Navigation is spatial (panel focus + j/k). Wide terminals show
four panes; narrow terminals collapse detail until drill-down.

### P4 — Read-mostly MVP

MVP ships **view + navigate + log tail + browser open**. Mutating CI
(retry/cancel/play) requires its own specified feature, confirmation UX, and
security notes.

### P5 — Reuse glab auth

Resolve GitLab host and personal access token from, in order:

1. Explicit env (`GITLAB_TOKEN`, `GITLAB_HOST` / `GITLAB_URL`)
2. `glab` config (`~/.config/glab-cli/config.yml` or equivalent)
3. Clear error if neither yields a usable credential

Do not implement a parallel login dance in MVP.

### P6 — Lazy API load

Each pane owns one primary resource family. Selection on the left invalidates
and reloads the right. Prefer `per_page` limits and on-focus fetches over
prefetching the world.

### P7 — Live when needed

While any selected or visible pipeline/job is active (`created`, `pending`,
`running`, `waiting_for_resource`, etc.), poll on a short interval (configurable,
default ~3s). When idle, back off or stop until user refresh or focus change.

### P8 — Bun + OpenTUI stack

| Layer | Choice |
|---|---|
| Runtime / package manager | Bun |
| Language | TypeScript |
| TUI | OpenTUI (`@opentui/core` and Solid or React bindings as planned) |
| GitLab | REST API v4 (`/api/v4`) thin typed client |
| Config | `~/.config/ciview/` for pins and preferences (not secrets) |

Implementation roots default under `src/**` (and root package manifests).

### P9 — English corpus

Committed documentation and specs are English so agents and validators stay
consistent. User-facing TUI strings may be English in MVP (i18n is optional later).

### P10 — No secrets in tree

Never commit tokens, private keys, or raw job logs that embed secrets. Support
read-only tokens for view-only deployments; document least privilege (`read_api`
sufficient for MVP read path).

### P11 — Async queue runtime (Bun)

ciview runs on **Bun** with an **async-first** concurrency model:

1. **Queue** — side effects (GitLab HTTP, prefs I/O, scheduled refresh) are jobs.
2. **Workers** — concurrent async consumers on the Bun event loop (not OS
   threads in MVP) execute jobs and apply results to the store.
3. **Observers** — the TUI subscribes to the store and redraws; workers never
   paint the terminal directly.

No synchronous network on the input path. Poll timers only **enqueue** work.
Selection changes cancel or supersede stale jobs. See ADR-0002.

## Product north star

> Open `ciview` → left sidebar shows projects with CI pulse → select project →
> browse pipelines → inspect stages/jobs with clear status → open running or
> failed job log — without leaving the terminal.

Comparable intent: **turbinated `glab ci` / pipeline view**, multi-project,
keyboard-first, visualization-first.

## Production / quality gates (MVP)

| Gate | Meaning | Evidence |
|---|---|---|
| G1 | Spec corpus validates | `speckit validate` exit 0 |
| G2 | Typecheck / tests green | Bun toolchain as defined in plan |
| G3 | Auth resolves on developer machine | Uses glab or env; fails clearly otherwise |
| G4 | No token in git history | `.gitignore` + review |

## Governance

| Rule | Detail |
|---|---|
| MADR for structural change | Constitution or stack changes need a MADR (`status: accepted`, ≥1 `deciders`) under `doc/arch/adr/` |
| Trivial edits | Typos/formatting may land without ADR |
| Scope expansion | New product surfaces (write actions, web UI, multi-host) need a feature spec first |
| Agent map | `AGENTS.md` stays path-anchored and pruned on drift |

## Non-goals (explicit)

- Replacing the GitLab web UI for all workflows
- Being a general TUI framework demo unrelated to CI
- Supporting non-GitLab CI systems in MVP
- Shipping mutating CI controls before a dedicated feature
