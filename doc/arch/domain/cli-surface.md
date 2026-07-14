# CLI surface

## Stable Exit Codes

Product binary (`bun run src/ciview/main.tsx`):

| Code | Meaning | Stable |
|------|---------|--------|
| `0` | success or clean quit | yes |
| `1` | unexpected runtime error | yes |
| `2` | auth failure (glab missing or no token) | yes |

Do not repurpose without an ADR under `doc/arch/adr/`. Speckit uses its own exit catalogue.

## --json Contract

ciview TUI has no product JSON mode. Agents use **speckit** with `--json`:

| Command | JSON stdout |
|---------|-------------|
| `speckit status --json` | yes |
| `speckit validate --json` | yes |
| `speckit verify --json` | yes |
| `speckit analyze --json` | yes |
| `speckit feature list --json` | yes |
| `speckit config list --json` | yes |

Human prose remains on stderr. `bun test` and `bun run typecheck` use exit codes only.

## Invocation

| Form | Behaviour |
|------|-----------|
| `bun run start` | interactive TUI via `src/ciview/main.tsx` |
| `bun run src/ciview/main.tsx -h` | help, exit `0` |
| `bun run src/ciview/main.tsx .` | open project from git remote |
| `bun run src/ciview/main.tsx group/name` | open named project path |

## Modules

| Area | Path |
|------|------|
| entry | `src/ciview/main.tsx` |
| auth | `src/ciview/auth/resolve.ts` |
| open project | `src/ciview/nav/openProject.ts` |
| graph UI | `src/ciview/ui/panes/PipelineGraph.tsx` |
| log drawer | `src/ciview/ui/panes/JobLogDrawer.tsx` |
| queue | `src/ciview/runtime/queue.ts` |
| graceful shutdown | `src/ciview/runtime/shutdown.ts` |
| tty restore | `src/ciview/runtime/terminalRestore.ts` |
| shutdown wire-up | `src/ciview/main.tsx` (`onDestroy` only) |

## Graceful stop (FR-27)

| Trigger | Exit |
|---------|------|
| `q`, `Ctrl-c`, SIGINT, SIGTERM, SIGQUIT, SIGHUP, … | `0` after full teardown |
| SIGKILL / SIGSTOP | **not handleable** — prefer SIGTERM |

**Ordered path (required):** cleanup → `renderer.destroy()` complete →
`restoreTerminalTty` → `process.exit(0)`. Never exit on the early `"destroy"`
event.

Normative detail:

- feature 001 `spec.md` FR-27
- `doc/arch/sdd/001-gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job/shutdown-flow.md`
- `keybindings.md` Process signals

## Keys

See `doc/arch/sdd/002-keep-project-sidebar-right-side-is-a-navigable-pipeline/keybindings.md`.
