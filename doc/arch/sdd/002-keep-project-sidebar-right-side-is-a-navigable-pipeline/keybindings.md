# Keybindings — feature 002 additions

Extends 001 `keybindings.md`. Single binding table in code must include these.

## Projects (sidebar)

| Key | Action |
|-----|--------|
| j/k | Move **cursor only** (no open, no recent reorder) |
| Enter | **Open** project → graph + recent update + load |
| / m s p | Unchanged (filter, scope, sidebar, pin) |

## Pipeline graph

| Key | Action |
|-----|--------|
| Tab | Cycle focus: projects → pipeline_strip → stage_board → job_log (if open) |
| h/l | Previous/next stage (or pipeline in strip when strip focused) |
| j/k | Previous/next job in stage (or pipeline when strip focused) |
| Enter | On strip: focus board. On job: **open log** |
| Esc | Close log if open; else focus projects / leave board |
| r | Refresh open project graph (user load) |
| o | Open focused pipeline/job web_url |
| f | Toggle log follow (only when log open) |

## Help

`?` still shows full table including 002 graph keys.
