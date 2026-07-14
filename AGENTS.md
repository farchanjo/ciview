# ciview — Agent Context

Canonical machine-readable map. Path-anchored. Prune on drift.

## Project

ciview: GitLab CI TUI (sidebar, stage board, smart log modal). Bun + TypeScript + OpenTUI React + p-queue (4) + RxJS. Auth glab-only. Corpus doc/arch. Code src/ciview. Layout via pure `layoutBudget` (termW×termH).

## Architecture

doc/arch: memory, functional, domain/cli-surface, operations, slo, adr, schemas, specs/features, sdd, observability, quality, threat-model, runbooks, speckit.toml.

src/ciview layers: auth, cli, config, git, gitlab, nav, poll, projects, runtime, state, ui, util.

Key modules: src/ciview/main.tsx, src/ciview/nav/openProject.ts, src/ciview/ui/panes/PipelineGraph.tsx, src/ciview/ui/panes/JobLogDrawer.tsx, src/ciview/util/layoutBudget.ts, src/ciview/util/smartLog.ts, src/ciview/runtime/queue.ts, src/ciview/auth/resolve.ts.

## Build & release (local only — NO GitHub Actions CI)

GitHub Actions is **disabled** (see `.github/CI_DISABLED.md`). Never add
`on: push` / `on: pull_request` workflows that build this repo.

### One command (preferred)

```bash
make ship                 # bump patch + check + binaries + tag + push + gh release
make ship PART=minor
make ship PART=major
make ship PART=1.2.0      # exact version
make ship-patch           # aliases: ship-minor, ship-major
```

`make ship` runs `scripts/ship.sh`:

1. Semver bump of `package.json` (`scripts/bump-version.mjs`, `PART=…`)
2. `make check` (tests + typecheck + lint + `speckit validate`) — skip with `SKIP_CHECK=1`
3. `make release-binaries` — darwin on this Mac + **linux-x64 on SSH**
4. Commit `chore: release vX.Y.Z` (package.json)
5. Annotated tag `vX.Y.Z`
6. `git push` branch + tag
7. `gh release create|upload` with **local** assets from `dist/release/`

| Env | Default | Meaning |
|-----|---------|---------|
| `PART` | `patch` | `patch` \| `minor` \| `major` \| `X.Y.Z` |
| `SSH_TARGET` | `root@vm.services` | Linux native builder |
| `SKIP_CHECK` | `0` | `1` = skip gates |
| `ALLOW_DIRTY` | `0` | `1` = allow dirty tree |
| `DRY_RUN` | `0` | `1` = bump only, stop |
| `CODESIGN_IDENTITY` | `-` | Apple codesign (ad-hoc) |

### Piecewise targets

| Target | What |
|--------|------|
| `make bump PART=…` | Only rewrite `package.json` version |
| `make build` / `make deploy` | Host binary + optional `/usr/local/bin` |
| `make build-darwin` | → `dist/release/ciview-darwin-*` |
| `make build-linux` | → `dist/release/ciview-linux-x64` via SSH |
| `make release-binaries` | darwin + linux + `SHA256SUMS` |
| `make release` | tag **current** package.json version + gh upload (no bump) |

### Rules for agents

- Prefer **`make ship`** for any release. Do not invent CI workflows.
- **Never** `bun build --target=bun-linux-*` on macOS (OpenTUI natives missing).
- Linux **must** compile on `SSH_TARGET` (`make build-linux` / ship).
- Binaries live under `dist/release/` (gitignored); only uploaded via `gh release`.
- Scripts: `scripts/ship.sh`, `scripts/bump-version.mjs`. Makefile wires `ship` / `bump`.
- After clone: **`make hooks-install`** (versioned hooks in `githooks/`).

## Local git hooks

Hooks live in **`githooks/`** (not `.git/hooks`) via `core.hooksPath`.

```bash
make hooks-install      # once per clone
make hooks-status
make hooks-uninstall    # optional
```

| Hook | Runs |
|------|------|
| `pre-commit` | Block secrets; eslint staged `src/**/*.{ts,tsx}`; typecheck + `bun test` if src/toolchain changes; `speckit validate` if `doc/arch/**` changes |
| `commit-msg` | Conventional Commits (`feat:`, `fix:`, `chore:`, …) |
| `pre-push` | Full `make check` before push |

Skip once: `SKIP_HOOKS=1 git commit …` / `SKIP_HOOKS=1 git push …`.  
Installer: `scripts/install-hooks.sh`.

## Commands

```
bun install
make hooks-install
bun run start
bun test
bun run typecheck
bun run check
bun run build
make ship
make ship PART=minor
make bump PART=patch
make build-darwin
make build-linux
make release-binaries
make release
speckit init
speckit constitution
speckit specify
speckit clarify
speckit plan
speckit plan setup
speckit tasks
speckit tasks setup
speckit analyze
speckit implement
speckit feature list
speckit feature select
speckit feature new
speckit feature renumber
speckit feature reorder
speckit feature insert
speckit feature compact
speckit feature archive
speckit feature restore
speckit status
speckit next
speckit validate
speckit verify
speckit explain
speckit search
speckit reindex
speckit reindex --deep
speckit check
speckit on
speckit off
speckit guard check
speckit guard hook
speckit config list
speckit config get
speckit config set
speckit config unset
speckit config drift
speckit context score
speckit context pack
speckit spec score
speckit semantic status
speckit semantic deep-status
speckit semantic enable
speckit semantic off
speckit semantic eval
speckit dedupe
speckit missing
speckit brief
speckit ask
speckit dismiss
speckit commit check
speckit commit suggest
speckit license list
speckit license show
speckit license set
speckit license check
speckit version
speckit completions
speckit guide
speckit manual
speckit diagram render
speckit workflow render
speckit mermaid render
speckit stats findings
speckit stats guard
speckit stats profile
speckit stats attributes
speckit stats compliance
speckit stats corpus
speckit stats recommendations
speckit model list
speckit model add
speckit model fetch
speckit model select
speckit model check
speckit model remove
speckit model api
speckit pack list
speckit pack add
speckit pack update
speckit pack remove
speckit pack export
speckit pack import
speckit library list
speckit library add
speckit library validate
speckit library show
speckit library update
speckit library remove
speckit library ask
speckit library search
speckit library open
speckit library browse
speckit library extract
speckit library export
speckit library import
speckit library serve
speckit gitlab status
speckit gitlab sync
speckit migrate
speckit hook session-start
speckit hook user-prompt
speckit hook post-edit
speckit hook pre-commit
```

Product exit code: 0 ok, 1 error, 2 auth. Speckit supports --json on management commands.
Config families: project git guard context dedupe adr stats semantic gitlab hygiene compliance workflow privacy.

## Conventions

- Spec-first protocol: run speckit status then speckit next; validate and verify green before commit.
- Guard in doc/arch/speckit.toml; never edit doc/.specify by hand.
- Cursor keys do not open projects; Enter opens. Silent poll. CI-only product.
- Angular Conventional Commits; no AI co-author trailers.

## Spec-first protocol

spec-first: doc/arch is the source of truth — run `speckit status` then `speckit next` and read the spec before writing any code.
