# Keybindings — learnable shortcut-first UI

ciview is **shortcut-first**: every primary action has a key. Discoverability
comes from:

1. **Help overlay** (`?`) — full cheatsheet grouped by category  
2. **Status bar hint** — always shows `?:help` (and a few essentials)  
3. **This document** — normative map for implementation and tests  

Single source of truth for keys in MVP. Changing a binding updates this file,
the help overlay content (generated from the same table in code), and Gherkin.

## Design rules

| Rule | Detail |
|------|--------|
| No mouse required | Full cockpit usable keyboard-only |
| Help is in-app | User learns without leaving the TUI |
| Overlay is modal | While help is open, only close keys work (`?`, `Esc`, `q` does not quit) |
| Sidebar hideable | Toggle with a shortcut; layout reflows; preference may persist |
| Conflict policy | Letter keys are global unless a text filter input is focused (`/`) |

## Help UI (required)

### Open / close

| Key | Action |
|-----|--------|
| `?` | Toggle **Help** overlay (shortcut cheatsheet) |
| `Esc` | Close Help if open; otherwise normal Esc behavior |

### Content

Help overlay is a scrollable modal (or full-width panel) that lists **all**
bindings below, grouped:

1. General / help  
2. Layout (sidebar, panes)  
3. Navigation  
4. Selection & drill  
5. CI actions (refresh, live, open, pin)  
6. Log / detail  
7. Filter  

Footer line: `?:close  j/k:scroll  Esc:close`

### First-run (optional MVP+)

Status bar always includes `?:help`. Optional later: one-time banner
“Press ? for shortcuts” — not required for MVP if `?:help` is always visible.

## Layout & sidebar

| Key | Action |
|-----|--------|
| `s` | **Toggle project sidebar** show/hide |
| `[` | Hide sidebar (no-op if already hidden) |
| `]` | Show sidebar (no-op if already visible) |
| `Tab` | Focus next pane (skips hidden sidebar) |
| `S-Tab` | Focus previous pane |
| `H` / `L` | Focus pane left / right (skip hidden) |
| `1` | Focus projects pane (shows sidebar if hidden) |
| `2` | Focus pipelines pane |
| `3` | Focus jobs pane |
| `4` | Focus detail/log pane |

When sidebar is hidden:

- Pipelines (or current non-sidebar focus) keep the selected project context  
- Status bar may show compact project path (`infra/csseed`)  
- `1` or `]` / `s` restores sidebar  

`sidebarVisible` lives in `uiChromeStore` and **may persist** in prefs
(`prefsStore.sidebarVisible`, default `true`).

## Navigation (lists)

| Key | Action |
|-----|--------|
| `j` / `↓` | Move cursor down in focused pane |
| `k` / `↑` | Move cursor up |
| `g g` | Jump to top of focused list (vim-style; optional chord) |
| `G` | Jump to bottom |
| `Ctrl-d` / `Ctrl-u` | Page down / up in focused list or log (if supported) |

If `g g` chord is costly in MVP, ship `g` = top and `G` = bottom only.

## Selection & drill

| Key | Action |
|-----|--------|
| `Enter` | Drill into item / confirm (project→pipelines, pipeline→jobs, job→log focus) |
| `o` | Open focused pipeline or job `web_url` in browser |
| `Esc` | Close Help if open; else clear filter if active; else focus pane to the left / up hierarchy |
| `Backspace` | Same as Esc for hierarchy (optional alias) |

## CI actions

| Key | Action |
|-----|--------|
| `r` | Refresh focused resource (user-priority job) |
| `R` | Toggle live poll on/off |
| `p` | Pin / unpin current project (SavePrefs) |
| `c` | Copy focused web_url or job id to clipboard (optional MVP; if hard, defer) |

## Log / detail

| Key | Action |
|-----|--------|
| `f` | Toggle log follow (tail) when job running |
| `Ctrl-e` / `Ctrl-y` | Scroll log down / up one line (optional) |
| `Space` | Page log down when detail focused (optional) |

## Filter

| Key | Action |
|-----|--------|
| `/` | Start filter on focused pane |
| `m` | Cycle project scope: **smart → pinned → all** |
| `Enter` | Commit filter and leave input |
| `Esc` | Clear project filter / leave filter mode |

**Projects filter (anti-chaos)**

- Mode **smart** (default): shows **PINNED** + **RECENT** only; does not dump all membership projects. Type `/` to search; multi-token AND (`infra seed` matches `infra/csseed`).
- Mode **pinned**: only stars.
- Mode **all**: full sorted list (use with filter when many projects).
- Filter is **live** while typing on the projects pane.
- Recent list persists in prefs when you open a project.

While filter input is focused, letter shortcuts do **not** fire (except Esc).

## General

| Key | Action |
|-----|--------|
| `?` | Toggle Help overlay |
| `q` | Quit ciview gracefully (**disabled while Help is open** — Esc/`?` close help first) |
| `Ctrl-c` | Quit gracefully (always; same path as process signals) |

## Process signals (FR-27)

All catchable stop signals share the **same graceful shutdown** as `q` /
`Ctrl-c`. Full ordered sequence (cleanup → destroy complete → tty restore →
`exit 0`) is normative in **`shutdown-flow.md`**.

| Signal | Typical source | Handled |
|--------|----------------|---------|
| `SIGINT` | Ctrl+C, `kill -INT` | yes |
| `SIGTERM` | `kill <pid>` (default), orchestrators | yes |
| `SIGQUIT` | Ctrl+\ , `kill -QUIT` | yes |
| `SIGHUP` | terminal closed / hangup | yes |
| `SIGABRT` | abort | yes (when platform delivers) |
| `SIGBREAK` | Windows break | yes (when platform delivers) |
| **`SIGKILL`** | `kill -9` | **no — uncatchable by the OS** |
| **`SIGSTOP`** | `kill -STOP` | **no — uncatchable by the OS** |

**Shell safety (required):**

1. Do **not** `process.exit` on OpenTUI `"destroy"` (too early).
2. Exit only from `onDestroy` / `afterRendererDestroyed` or after
   `renderer.destroy()` has returned.
3. Always run `restoreTerminalTty` (leave alt screen, disable Kitty CSI-u,
   show cursor, raw mode off) before exit.

**Ops rule:** never rely on `kill -9` for ciview. Use `q`, `Ctrl-c`, or
`kill <pid>` / `kill -TERM <pid>` so the TUI leaves the terminal clean.

Code: `src/ciview/runtime/shutdown.ts`, `src/ciview/runtime/terminalRestore.ts`,
`main.tsx` wire-up.

## Status bar (always on)

Minimum chrome so users learn without opening Help:

```text
?:help  s:sidebar  Tab:pane  j/k  Enter  r:refresh  R:live  o:open  q:quit
```

Truncate on narrow terminals to: `?:help  s  Tab  j/k  Enter  q`

## Implementation notes

- Define bindings as a typed table in `src/ui/keys.ts` (or `keybindings.ts`):
  `{ key, label, category, intent, when? }[]`
- Help overlay **renders that table** — do not hardcode a second divergent list
- `when` examples: `helpOpen`, `filterActive`, `sidebarVisible`, `focusedPane`
- Intents update `uiChromeStore` sync; only CI loads go through `p-queue`

## Out of scope (MVP)

- User-remappable keys in a config UI  
- Mouse-only workflows as primary  
- Separate man-page dependency for basic use (README may still list keys)
