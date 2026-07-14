# ciview — Agent Context

Canonical machine-readable map. Path-anchored. Prune on drift.

## Project

ciview: GitLab CI TUI (sidebar, stage board, on-demand log). Bun + TypeScript + OpenTUI React + p-queue (4) + RxJS. Auth glab-only. Corpus doc/arch. Code src/ciview.

## Architecture

doc/arch: memory, functional, domain/cli-surface, operations, slo, adr, schemas, specs/features, sdd, observability, quality, threat-model, runbooks, speckit.toml.

src/ciview layers: auth, cli, config, git, gitlab, nav, poll, projects, runtime, state, ui, util.

Key modules: src/ciview/main.tsx, src/ciview/nav/openProject.ts, src/ciview/ui/panes/PipelineGraph.tsx, src/ciview/ui/panes/JobLogDrawer.tsx, src/ciview/runtime/queue.ts, src/ciview/auth/resolve.ts.

## Build & release (local only — NO GitHub Actions CI)

GitHub Actions is **disabled** (see `.github/CI_DISABLED.md`). Never add
`on: push` CI that builds this repo unless explicitly re-enabled.

| Target | What |
|--------|------|
| `make build` / `make deploy` | Local host binary + optional `/usr/local/bin` |
| `make build-darwin` | macOS artifact → `dist/release/ciview-darwin-*` |
| `make build-linux` | Linux x64 via **SSH** `root@vm.services` (native OpenTUI) |
| `make release-binaries` | darwin + linux + `SHA256SUMS` |
| `make release` | tag `VERSION` + `gh release` upload **local** assets |

```
# Linux builder (default)
export SSH_TARGET=root@vm.services   # or SSH_HOST=vm.services SSH_USER=root

make check
make release-binaries
make release VERSION=v0.1.0
```

Do **not** use `bun build --target=bun-linux-*` on macOS for OpenTUI (missing
native optional packages). Always compile Linux on the SSH host.

## Commands

```
bun install
bun run start
bun test
bun run typecheck
bun run check
bun run build
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
