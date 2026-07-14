# Keybindings — multi-host GitLab picker (feature 004)

Extends the global map from features 001–003. Host picker is a **modal**
overlay: while open, only picker keys (and quit) apply.

## Host picker (modal open)

| Key | Action |
|-----|--------|
| `j` / `↓` | Move cursor down |
| `k` / `↑` | Move cursor up |
| `Enter` | Confirm host → save prefs → setAuth → LoadProjects |
| `1`–`9` | Jump cursor to that list index (1-based) and confirm if valid |
| `Esc` | Dismiss **only if** `hostPickerRequired` is false (already have a host) |
| `q` | Quit process (same as global; required picker still allows quit) |
| `?` | Blocked while picker open (close picker first) |

## Global (picker closed)

| Key | Action |
|-----|--------|
| `H` (shift+h) | Open host picker when **≥ 2** authenticated hosts; no-op when 0–1 |

## Design rules

- Single-host installs never see the picker (FR-63).
- Required first pick cannot be Esc-dismissed (FR-64).
- Help overlay documents `H` under General / Auth category.
