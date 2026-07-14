# :rocket: ciview

[![spec-driven](https://img.shields.io/badge/spec--driven-development-blue)](doc/arch/)
[![runtime](https://img.shields.io/badge/runtime-Bun-f472b6)](https://bun.sh)
[![ui](https://img.shields.io/badge/UI-OpenTUI-0ea5e9)](https://opentui.com)
[![ci](https://img.shields.io/badge/focus-GitLab%20CI-fc6d26)](https://docs.gitlab.com/ee/ci/)

**ciview** is a terminal CI cockpit for GitLab: a multi-pane OpenTUI navigator
for **projects → pipelines → jobs → logs**. Think of it as a turbinated
`glab ci` / pipeline view — keyboard-first, live while builds run, **CI only**.

> Status: **spec complete, implementation not started yet.**  
> Architecture and tasks live under [`doc/arch/`](doc/arch/).

## :books: Index

- [Why](#why)
- [Features (planned MVP)](#features-planned-mvp)
- [Architecture](#architecture)
- [Stack](#stack)
- [Repository layout](#repository-layout)
- [Getting started (specs)](#getting-started-specs)
- [Auth (planned)](#auth-planned)
- [Documentation](#documentation)
- [Contributing](#contributing)

## :compass: Why

GitLab CI is powerful, but watching it “happen” means jumping between browser
pages and CLI subcommands. **ciview** keeps you in the terminal with:

- a **left project sidebar** (pins + CI pulse)
- **pipelines** and **jobs by stage** with clear status glyphs
- **job log tail** while a build is running
- **live poll** only when something is active (async, non-blocking)

## :sparkles: Features (planned MVP)

- Multi-pane cockpit: projects | pipelines | stages/jobs | detail/log
- Keyboard navigation (vim-ish: j/k, h/l, Enter, Esc)
- Read-only GitLab REST API v4 (no retry/cancel in MVP)
- Auth from `GITLAB_TOKEN` / host env **or** existing [glab](https://gitlab.com/gitlab-org/cli) config
- Focus modes: dashboard, current git remote (`.`), `group/project` path
- Open focused pipeline/job in the browser

Out of scope for MVP: issues, MR editing, source browser, registry, runner admin.

## :gear: Architecture

Async-first on **Bun** ([ADR-0002](doc/arch/adr/0002-async-workers-queue-observer-bun.md)):

```text
UI keys  →  enqueue(job)  →  async worker pool  →  store.apply
                                                      ↓
                                              observers → redraw TUI
```

- **Queue** — all GitLab HTTP and prefs I/O are jobs  
- **Workers** — concurrent async consumers on Bun’s event loop (not OS threads in MVP)  
- **Observers** — TUI only reacts to store changes; handlers never paint  

## :wrench: Stack

| Layer | Choice |
|-------|--------|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript |
| TUI | [OpenTUI](https://opentui.com) |
| API | GitLab REST v4 |
| Auth | env or glab config |
| Specs | [speckit](https://github.com/) / `doc/arch` |

## :file_folder: Repository layout

```text
doc/arch/           # source of truth (constitution, specs, ADRs, tasks)
  memory/           # constitution
  sdd/001-…/        # feature spec, plan, tasks
  adr/              # architecture decisions
  specs/features/   # Gherkin
src/                # implementation (not started)
```

## :hammer_and_wrench: Getting started (specs)

This repo is **spec-driven**. Before code:

```bash
speckit status
speckit next
speckit validate   # must be 0 findings before commits that touch the corpus
```

Feature **001** is specified → clarified → planned → tasked → analyzed.
Next lifecycle step: **`speckit implement`** (see tasks T001+).

Key docs:

| Doc | Path |
|-----|------|
| Constitution | [`doc/arch/memory/constitution.md`](doc/arch/memory/constitution.md) |
| Product overview | [`doc/arch/functional/product-overview.md`](doc/arch/functional/product-overview.md) |
| Feature spec | [`doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/spec.md`](doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/spec.md) |
| Plan | [`doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/plan.md`](doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/plan.md) |
| Tasks | [`doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/tasks.md`](doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/tasks.md) |
| ADR Bun+OpenTUI | [`doc/arch/adr/0001-….md`](doc/arch/adr/0001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job.md) |
| ADR async runtime | [`doc/arch/adr/0002-async-workers-queue-observer-bun.md`](doc/arch/adr/0002-async-workers-queue-observer-bun.md) |

## :key: Auth (planned)

```bash
# Option A — glab
glab auth status

# Option B — environment
export GITLAB_HOST=https://gitlab.example.com
export GITLAB_TOKEN=glpat-...   # read_api is enough for MVP
```

## :open_book: Documentation

- [`AGENTS.md`](AGENTS.md) — map for AI agents / automation  
- [`doc/arch/`](doc/arch/) — full spec corpus  

## :handshake: Contributing

1. Read the constitution and the active feature spec under `doc/arch/`.  
2. Prefer changing specs first, then code (`speckit` workflow).  
3. Keep the product **CI-only** and the runtime **async queue/observer** based.  

## License

License not set yet — will be declared via project metadata before the first
runtime release.
