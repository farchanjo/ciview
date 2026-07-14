---
status: accepted
date: 2026-07-14
deciders: [farchanjo]
consulted: []
informed: []
---

# ADR-0006: Multi-host glab picker with persisted host preference

## Context and Problem Statement

Operators authenticate several GitLab instances via glab. ciview historically
picked the first/default host from glab config and only looked at
`~/.config/glab-cli/config.yml`. That fails when:

1. Tokens live under macOS Application Support or `GLAB_CONFIG_DIR`.
2. The operator needs a **different** host than the default.
3. The product must not re-prompt every launch once a host is chosen.

## Decision Drivers

- glab-only credentials (001 FR-01) — no second PAT store
- Zero friction when only one host exists
- Explicit choice when ≥ 2 hosts are authenticated
- Persist choice across sessions (hostname only)
- Keyboard-first TUI consistent with Help/log modals
- Do not paint or persist tokens outside glab

## Considered Options

- **A.** Always use glab default `host:` — no multi-host UX
- **B.** CLI flag `--host` only — friction; not discoverable in TUI
- **C.** Host picker modal when ≥ 2 hosts; skip when 1; persist `gitlabHost`;
  key `H` to re-open (chosen)
- **D.** Shell prompt before TUI — breaks immersive cockpit; harder to re-switch

## Decision Outcome

Chosen option: **C**.

### Rules

| Authenticated hosts | Startup | Mid-session |
|--------------------|---------|-------------|
| 0 | Exit 2 + fix steps | n/a |
| 1 | Bind silently; no modal | `H` does not open picker |
| ≥ 2, valid `prefs.gitlabHost` | Silent bind to saved host | `H` opens picker |
| ≥ 2, missing/invalid saved | Required picker before LoadProjects | after pick, Esc may dismiss |

### Config discovery order

`GLAB_CONFIG_DIR` → `XDG_CONFIG_HOME/glab-cli` → `~/.config/glab-cli` →
darwin `~/Library/Application Support/glab-cli`.

### Persistence

`~/.config/ciview/config.json` field `gitlabHost` (hostname string or null).
Token never written there. Client supports `setAuth` for in-process switch.

### Consequences

- Good: correct host for multi-tenant operators; no nag on single-host laptops
- Good: macOS glab path works without manual symlink
- Good: status bar already shows host; switch is obvious after `H`
- Bad: host switch drops open project context (acceptable; different membership)
- Bad: hosts with token only in OS keyring (not in yaml) remain unsupported
  until glab exposes them in config.yml

## Relationship

- Refines 001 FR-01 path resolution and host selection
- Feature 004 SDD is the implementation vehicle
- Does not supersede glab-only policy
