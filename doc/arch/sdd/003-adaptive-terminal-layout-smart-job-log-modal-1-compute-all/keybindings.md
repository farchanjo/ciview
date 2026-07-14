# Keybindings — feature 003 (log modal additions)

Base bindings from 001/002 remain. While **log modal is open**, these take priority:

| Key | Action |
|-----|--------|
| `j` / `↓` | Scroll log view down one line |
| `k` / `↑` | Scroll log view up one line (pauses follow) |
| `PgUp` / `PgDn` | Full page up / down (one viewport of contentRows) |
| `Space` / `Ctrl+d` | Half-page down |
| `b` / `Ctrl+u` | Half-page up |
| `n` | Next hard error |
| `N` | Previous hard error |
| `e` | Cycle log mode smart → errors → all |
| `g` | Jump to top of current view |
| `G` | Jump to end + enable follow |
| `f` | Toggle follow (on → scroll end) |
| `Esc` | Close log modal (or pop child pipeline if applicable before leave) |
| `o` | Open job/pipeline web_url (unchanged) |
| `r` | Refresh trace when focused on log (unchanged) |
| `?` | Help (help z-index above log) |
| `q` | Quit (unchanged) |

Board/sidebar bindings apply when log is closed (002).
