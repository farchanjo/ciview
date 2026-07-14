---
id: 019f623e-8f58-7412-9d26-07d658d56288
number: 004
slug: multi-host-gitlab-picker
status: implemented
created_at: 2026-07-14T20:08:14.936198Z
---
# Feature Specification: Multi-host GitLab picker

Feature: 004-multi-host-gitlab-picker
Created: 2026-07-14
Depends on: 001 (glab-only auth, runtime, prefs), 002/003 (TUI overlays, keys)

## Summary

Operators often authenticate **multiple** GitLab instances with glab
(`git.example.com`, `gitlab.com`, …). ciview must:

1. Discover every glab host that has a usable API token.
2. **Skip any picker when exactly one** host is authenticated — bind to that host.
3. When **two or more** hosts are authenticated:
   - On first launch (or when the saved host is missing/invalid), open a
     **host picker modal** before loading projects.
   - Persist the chosen hostname in local prefs (`gitlabHost`).
   - On later launches, reuse the saved host **without** showing the modal.
   - Offer a keyboard shortcut (`H`) to reopen the picker and switch host
     mid-session (reload projects for the new host).

Also fix glab config discovery so macOS/Homebrew paths
(`~/Library/Application Support/glab-cli/`) and `GLAB_CONFIG_DIR` /
`XDG_CONFIG_HOME` are found — not only `~/.config/glab-cli/config.yml`.

Auth remains **glab-only** (no env PAT as primary). Tokens stay in glab
config; prefs store **hostname only**, never the token.

## User Stories

- As a developer with **one** glab host, I want ciview to open immediately on
  that host so I am not blocked by an empty choice screen.
- As a developer with **multiple** glab hosts, I want to pick which GitLab
  instance to use on first open so I work against the right membership set.
- As a developer who already chose a host, I want the next launch to reopen
  that same host without asking again.
- As a developer who needs another instance, I want a keybinding to switch
  GitLab mid-session and reload the project list for that host.

## Functional Requirements

### Glab discovery

1. **FR-60 Config path candidates.** Resolve glab `config.yml` from the first
   existing file among (priority order):
   1. `$GLAB_CONFIG_DIR/config.yml` when `GLAB_CONFIG_DIR` is set
   2. `$XDG_CONFIG_HOME/glab-cli/config.yml` when `XDG_CONFIG_HOME` is set
   3. `~/.config/glab-cli/config.yml`
   4. On darwin: `~/Library/Application Support/glab-cli/config.yml`
2. **FR-61 Authenticated host list.** Build the list of hosts that have a
   non-empty `token` under `hosts:` in that config. Each entry exposes at least
   `hostname`, `apiHost` (from `api_host` or hostname), optional `user`, and
   never paints the raw token in the UI.
3. **FR-62 Zero hosts.** If glab is missing or no host has a token, exit with
   auth error code **2** and the existing install/login fix steps (001 FR-01).

### Single vs multi host

4. **FR-63 Single host — no picker.** When the authenticated host list has
   **exactly 1** entry, resolve auth for that host, start the TUI, and
   **never** open the host picker (not at startup, and `H` is a no-op or shows
   a one-line status that only one host exists — preferred: do not open modal).
5. **FR-64 Multi host — first pick.** When the list has **≥ 2** hosts and
   prefs `gitlabHost` is null or does not match any authenticated host, open
   the host picker modal on startup **before** `LoadProjects`. The picker is
   **required** (Esc does not dismiss; `q` still quits).
6. **FR-65 Multi host — saved pick.** When the list has **≥ 2** hosts and
   prefs `gitlabHost` matches an authenticated host, resolve that host
   silently, skip the modal, and load projects for that host.

### Persistence

7. **FR-66 Prefs field.** Extend `Prefs` with `gitlabHost: string | null`
   (hostname without scheme, e.g. `git.eonf.ltd`). Persist under the existing
   ciview prefs path (`~/.config/ciview/config.json` or XDG). Never write the
   PAT into prefs.
8. **FR-67 Save on confirm.** On picker Enter, set `prefs.gitlabHost` to the
   chosen hostname, enqueue `SavePrefs`, apply auth, and load projects.

### Picker UI + keys

9. **FR-68 Host picker modal.** Absolute overlay (same pattern as Help/log
   modals). Lists authenticated hostnames (and user when known). j/k or
   arrows move cursor; Enter confirms; optional digits 1–9 jump/select.
10. **FR-69 Switch key.** With **≥ 2** hosts, key **`H`** (shift+h) opens the
    host picker mid-session (help/log closed). Esc dismisses only when a host
    is already active (`hostPickerRequired === false`). After confirm on a
    **different** host: swap client credentials, clear project/pipeline/job/
    selection slices, update session host, save prefs, `LoadProjects`.
11. **FR-70 Help + status.** Document `H` in `keys.ts` / Help overlay and
    mention host in the status bar (already shows host). Compact status hint
    may include `H:host` when multi-host is available.

### Compatibility

12. **FR-71 Auth surface.** Token source remains `glab` only. `GitLabClient`
    must support swapping auth (`setAuth`) without restarting the process.
13. **FR-72 No CI mutations.** Read-only API use unchanged (001 FR-11).

## Non-Functional Requirements

1. **NFR-60 Spec-first.** Plan/tasks + green `speckit analyze` / `validate`
   before calling the feature implemented.
2. **NFR-61 Pure-friendly discovery.** Path candidate order and host-key
   normalization are unit-testable without a live TUI.
3. **NFR-62 Token safety.** UI, prefs, logs, and status never emit the token
   value (masked or omitted).
4. **NFR-63 Switch cost.** Host switch clears in-memory project state and
   reloads; no attempt to merge two hosts’ project lists.

## Security Requirements

- **Data sensitivity/classification.** Reads glab config (contains PATs).
  Displays hostnames and optional usernames only. Prefs store hostname only.
- **Authentication/authorization.** No new credential store: reuses glab
  tokens already on disk. Operator must already be logged into each host via
  `glab auth login`.
- **Input validation.** Hostnames from YAML are treated as opaque strings;
  API base is `https://` + api_host/hostname. Malformed YAML → treat as no
  config (auth error path).
- **Cryptography in transit/at rest.** HTTPS to GitLab API unchanged; tokens
  remain in glab config permissions; prefs file has no secret.
- **Logging/audit.** Never log tokens or full config file contents.
- **Error-handling information exposure.** Auth errors name the host key when
  useful (`no API token for host "…"`) but never the token.

## Acceptance Scenarios

1. Given glab config with **exactly one** host that has a token,
   When the user runs `ciview`,
   Then the TUI starts on that host with **no** host picker modal.
2. Given glab config with **two or more** hosts that have tokens and
   prefs `gitlabHost` is unset,
   When the user runs `ciview`,
   Then the host picker modal is open and projects are not loaded until Enter.
3. Given multi-host glab and prefs `gitlabHost` equal to a valid host,
   When the user runs `ciview`,
   Then that host is used with **no** modal and projects load.
4. Given multi-host session already on host A,
   When the user presses `H`, picks host B, and presses Enter,
   Then session host becomes B, prefs save B, and projects reload for B.
5. Given glab config only under `~/Library/Application Support/glab-cli/`
   on macOS (empty or missing `~/.config/glab-cli`),
   When ciview resolves auth,
   Then hosts from Application Support are discovered.
6. Given zero hosts with tokens,
   When the user runs `ciview`,
   Then exit code is 2 with authenticate fix steps.

## Observability

- Session status bar continues to show active host (no token).
- Optional debug: count of authenticated hosts at startup (integer only).
- Conventions: `doc/arch/observability/observability.md`.
- No OTLP requirement beyond existing product stance.

## Relationship

- Extends 001 FR-01 (glab auth) with multi-host selection and path discovery.
- Extends 001 FR-14 prefs with `gitlabHost`.
- Uses 003-style absolute modal overlay for the picker.
- Does not change p-queue concurrency or CI mutation policy.

## Clarifications

- Single-host: no modal at all (confirmed operator preference).
- Multi-host: modal on first pick; persist; `H` to switch later.
- Token remains in glab only; prefs hostname only.
