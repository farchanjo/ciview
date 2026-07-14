# Implementation Plan: Feature 004 — Multi-host GitLab picker

## Overview

Implement FR-60…FR-72: multi-path glab config discovery, authenticated host
list, single-host silent bind, multi-host required picker + persisted
`gitlabHost`, mid-session switch via `H`, and client `setAuth`.

Partial code may already exist (`resolve.ts` multi-path + list, prefs field,
chrome hostPicker flags, `GitLabClient.setAuth`). This plan **completes** the
TUI modal, startup wiring, SavePrefs field, tests, and docs.

## Goals

1. Discover glab hosts with tokens from all standard config locations.
2. **1 host → no modal**; **≥ 2 hosts → picker when needed**.
3. Persist `gitlabHost`; restore on next launch.
4. Key `H` reopens picker and reloads data for the new host.
5. Never surface tokens in UI/prefs/logs.

## Non-goals

- Keyring-only tokens not present in config.yml
- Writing tokens into ciview prefs
- CLI `--host` flag (optional later; not required by FR)
- CI mutations or multi-host project merge

## Technical Approach

### Layers

| Layer | Path | Role |
|-------|------|------|
| Auth domain | `src/ciview/auth/resolve.ts` | paths, list hosts, resolveAuth(preferred) |
| Prefs | `src/ciview/config/prefs.ts` | `gitlabHost` load/save |
| Client | `src/ciview/gitlab/client.ts` | `setAuth` |
| State | `src/ciview/state/root.ts` | hostPicker* chrome flags |
| Switch | `src/ciview/auth/switchHost.ts` (or inline main/App) | clear slices + setAuth + LoadProjects |
| UI | `src/ciview/ui/HostPickerOverlay.tsx` | modal list |
| UI keys | `App.tsx`, `keys.ts` | capture + `H` |
| Bootstrap | `main.tsx` | list hosts → decide picker vs silent |

### Startup algorithm

```
hosts = listAuthenticatedHosts()
if hosts.length == 0 → AuthError exit 2
if hosts.length == 1 → auth = resolve(hosts[0]); load projects; no picker
if hosts.length >= 2:
  if findHost(prefs.gitlabHost) → auth = resolve(saved); load projects
  else → open required picker (provisional auth = first host OK for client ctor);
         LoadProjects only after confirm
```

### Host switch (H → Enter)

1. resolveAuth(selectedHostname)
2. client.setAuth(auth)
3. session.host / tokenSource update
4. prefs.gitlabHost = hostname; SavePrefs
5. clear projects/pipelines/jobs/trace/selection; reset board cursor
6. close picker; enqueue LoadProjects

### Layout

Reuse `computeLayoutBudget` helpModal metrics (or small hostModal clone) for
overlay size — no new density tiers required.

### Tests

- `glabConfigCandidates` order includes darwin Application Support
- `listAuthenticatedHosts` / `findHostOption` pure unit with fixture YAML path
  via env `GLAB_CONFIG_DIR` tempdir
- prefs load/save `gitlabHost`
- single vs multi decision helpers if extracted

## Task phases

1. Spec/docs (this feature) — authoring
2. Auth discovery complete + unit tests
3. Prefs + SavePrefs + client setAuth
4. HostPickerOverlay + App/main wiring
5. Help keys + STATUS_HINT
6. Gates: bun test, typecheck, validate

## Dependencies

- Features 001–003 implemented
- OpenTUI absolute modal pattern (HelpOverlay)
