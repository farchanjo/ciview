# GROK.md — Grok Build notes

Canonical project map: see AGENTS.md.

## Project

Grok Build session file for ciview. Terminal CI navigator for GitLab. Open projects with Enter; stage board navigation; job log on demand.

## Architecture

Corpus under doc/arch. Implementation layers under src/ciview: auth, cli, config, git, gitlab, nav, poll, projects, runtime, state, ui, util. Entry src/ciview/main.tsx.

## Build & release (local only)

GitHub Actions CI is **off**. Never rely on GHA to compile.

| Command | Notes |
|---------|--------|
| `make build-darwin` | This Mac → `dist/release/ciview-darwin-arm64` (or x64) |
| `make build-linux` | `ssh root@vm.services` rsync + native `bun build --compile` |
| `make release-binaries` | Both platforms + SHA256SUMS |
| `make release` | `git tag` + `gh release create` with **local** assets |

SSH defaults: `SSH_TARGET=root@vm.services`. Override with env if needed.
OpenTUI has platform-native deps — **no** macOS→Linux cross-compile.

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

Use bun for tests. Use glab for credentials. Do not force-push. Keep guard scope honest.

## Spec-first protocol

spec-first: doc/arch is the source of truth — run `speckit status` then `speckit next` and read the spec before writing any code.
