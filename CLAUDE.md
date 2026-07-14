# CLAUDE.md — Claude Code notes

Companion to AGENTS.md (canonical project map is AGENTS.md).

## Project

Claude Code working notes for ciview. Local GitLab CI cockpit. Stack Bun OpenTUI React TypeScript. Auth via glab (exit code 2 if missing).

## Architecture

Paths: doc/arch/memory/constitution.md; doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/; doc/arch/sdd/002-keep-project-sidebar-right-side-is-a-navigable-pipeline/; src/ciview layers auth, cli, config, git, gitlab, nav, poll, projects, runtime, state, ui, util.

## Build & release (local only)

**Do not enable GitHub Actions CI.** See `.github/CI_DISABLED.md` and AGENTS.md.

### Ship in one command

```bash
make ship                 # patch bump + check + darwin/linux + tag + push + gh release
make ship PART=minor
make ship PART=major
make ship PART=1.2.0
make ship-patch           # also: ship-minor, ship-major
```

Pipeline (`scripts/ship.sh`):

1. Bump `package.json` (`PART=patch|minor|major|X.Y.Z`)
2. `make check` (unless `SKIP_CHECK=1`)
3. Darwin binary on this Mac; Linux x64 via **SSH** `root@vm.services`
4. Commit + tag `vX.Y.Z` + push
5. `gh release` with local assets only (`dist/release/`)

| Env | Use |
|-----|-----|
| `PART` | Semver part or exact version |
| `SSH_TARGET` | Default `root@vm.services` |
| `SKIP_CHECK=1` | Skip tests/validate |
| `ALLOW_DIRTY=1` | Ship with dirty tree |
| `DRY_RUN=1` | Bump print only |

Piecewise: `make bump`, `make release-binaries`, `make release` (no bump).

**Agents:** prefer `make ship`. Never cross-compile Linux on macOS for OpenTUI.

## Local git hooks

```bash
make hooks-install    # once per clone — sets core.hooksPath=githooks
```

| Hook | Behavior |
|------|----------|
| `pre-commit` | secrets block; eslint staged TS; typecheck+test if `src/` changes; `speckit validate` if `doc/arch/` changes |
| `commit-msg` | Conventional Commits (`feat:`, `fix:`, `chore:`, …) |
| `pre-push` | `make check` |

Skip: `SKIP_HOOKS=1 git commit …`. Details: AGENTS.md.

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

Keep validate and verify green. Prefer openProject over selection thrash. Feature 002 board UX is current.

## Spec-first protocol

spec-first: doc/arch is the source of truth — run `speckit status` then `speckit next` and read the spec before writing any code.
