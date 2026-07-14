# GROK.md — Grok Build notes

Canonical project map: see AGENTS.md.

## Project

Grok Build session file for ciview. Terminal CI navigator for GitLab. Open projects with Enter; stage board navigation; job log on demand.

## Architecture

Corpus under doc/arch. Implementation layers under src/ciview: auth, cli, config, git, gitlab, nav, poll, projects, runtime, state, ui, util. Entry src/ciview/main.tsx.

## Build & release (local only)

GitHub Actions CI is **off** (`.github/CI_DISABLED.md`). Never rely on GHA.

### Preferred: one-shot ship

```bash
make ship                 # patch + check + binaries + tag + push + GitHub Release
make ship PART=minor
make ship PART=major
make ship PART=1.2.0
make ship-patch | ship-minor | ship-major
```

What `make ship` does (`scripts/ship.sh` + `scripts/bump-version.mjs`):

| Step | Action |
|------|--------|
| 1 | Semver bump `package.json` (`PART`) |
| 2 | `make check` (skip: `SKIP_CHECK=1`) |
| 3 | `build-darwin` on this Mac (codesign) |
| 4 | `build-linux` via **SSH** `SSH_TARGET` (default `root@vm.services`) |
| 5 | `SHA256SUMS` in `dist/release/` |
| 6 | Commit `chore: release vX.Y.Z`, annotated tag, push |
| 7 | `gh release create|upload` **local** assets only |

| Env | Default | Notes |
|-----|---------|--------|
| `PART` | `patch` | also `minor` / `major` / `1.2.3` |
| `SSH_TARGET` | `root@vm.services` | Linux native OpenTUI build |
| `ALLOW_DIRTY` | `0` | set `1` if tree dirty |
| `DRY_RUN` | `0` | set `1` to only bump and stop |

Piecewise (when not shipping):

| Command | Notes |
|---------|--------|
| `make bump PART=…` | package.json only |
| `make build-darwin` | → `dist/release/ciview-darwin-*` |
| `make build-linux` | rsync + compile on SSH host |
| `make release-binaries` | both + checksums |
| `make release` | tag **current** version + gh upload (no bump) |

OpenTUI has platform-native deps — **no** macOS→Linux cross-compile.

## Commands

```
bun install
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

Use bun for tests. Use glab for credentials. Do not force-push. Keep guard scope honest.

## Spec-first protocol

spec-first: doc/arch is the source of truth — run `speckit status` then `speckit next` and read the spec before writing any code.
