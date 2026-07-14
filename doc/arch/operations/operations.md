# Operations

Local TUI operations for `ciview` (no multi-node fleet).

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `PATH` | yes | must include `glab` and `bun` |
| `XDG_CONFIG_HOME` | no | prefs root for pins/recent/scope/live |
| `SPECKIT_PROJECT_ROOT` | no | corpus tooling only |
| `GITLAB_TOKEN` | no | **not** primary; glab owns credentials |

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| `0` | ok / clean quit | none |
| `1` | runtime error | read stderr; file issue if repeatable |
| `2` | auth failure | `brew install glab` then `glab auth login` |

## Graceful shutdown (FR-27)

ciview is a long-lived TUI. Stopping it **must** restore the terminal and
leave the **parent shell usable** (no alt-screen residue, no Kitty `…;5u`
garbage, no stuck raw mode).

| Preferred stop | Command / key |
|----------------|---------------|
| In TUI | `q` or `Ctrl-c` |
| Remote / shell | `kill <pid>` or `kill -TERM <pid>` (SIGTERM) |
| Interrupt | `kill -INT <pid>` (SIGINT) |

**Do not use `kill -9` (SIGKILL)** for normal stop. SIGKILL is uncatchable:
handlers never run, raw mode may leave the terminal broken, and the process
cannot flush cleanup. If a hang requires SIGKILL, reset the tty afterward
(`reset` or open a new tab).

### Required order (all triggers)

1. Stop poll + clear queue + unwire effects.
2. `renderer.destroy()` to completion (native OpenTUI restore).
3. `restoreTerminalTty()` (leave alt screen, disable Kitty CSI-u, show cursor).
4. `process.exit(0)`.

**Never** call `process.exit` on OpenTUI’s mid-cycle `"destroy"` event — only
from `onDestroy` / after destroy returns.

Normative sequence:  
`doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/shutdown-flow.md`  
Also: FR-27 in `spec.md`, Process signals in `keybindings.md`, modules
`src/ciview/runtime/shutdown.ts` + `terminalRestore.ts`.

## Environments

| Name | Command |
|------|---------|
| workstation | `bun run start` after `glab auth status` |
| CI | `speckit validate` · `speckit verify` · `bun test` · `bun run typecheck` |

## Run (dev from source)

```bash
bun install
glab auth status
bun run src/ciview/main.tsx
# or
make start
```

## Deploy (standalone binary → `/usr/local/bin`)

```bash
make deploy
# Developer ID (optional):
# make deploy CODESIGN_IDENTITY="Developer ID Application: Name (TEAMID)"
```

| Target | Action |
|--------|--------|
| `make build` | `bun build --compile` → `dist/ciview` |
| `make sign` | Apple `codesign` (default ad-hoc `-`) |
| `make install` | `sudo install` → `/usr/local/bin/ciview` + re-sign |
| `make deploy` | build + sign + install |
| `make uninstall` | `sudo rm` installed binary |

Normative detail: `doc/arch/runbooks/deploy.md`.

## Incidents

| Symptom | Fix |
|---------|-----|
| exit `2` | install + authenticate glab |
| empty board | Enter on a project with pipelines |
| list thrash | ensure openProject-only recent updates (`src/ciview/nav/openProject.ts`) |
