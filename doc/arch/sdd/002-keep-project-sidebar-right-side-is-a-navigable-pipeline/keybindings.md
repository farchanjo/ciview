# Keybindings — feature 002 additions

Extends 001 `keybindings.md`. Single binding table in code must include these.

## Projects (sidebar)

| Key | Action |
|-----|--------|
| j/k | Browse projects: move cursor **and** select so the right pane loads (like pipeline strip). **No** RECENT reorder. **Focus stays** on projects. |
| Enter | Confirm open + **pushRecent**; graph already follows j/k. **Focus stays** on projects (Tab/2/3 to move right) |
| / m s p | Unchanged (filter, scope, sidebar, pin) |
| y | Cycle RECENT ranking: **activity** (API last pipeline/activity) ↔ **opened** (local MRU) |
| x | Expand/collapse RECENT cap **10 ↔ 20** (beyond that: `/` filter) |

## Pipeline graph

| Key | Action |
|-----|--------|
| Tab | Cycle focus: projects → pipeline_strip → stage_board → job_log (if open) |
| h/l | Previous/next stage (or pipeline in strip when strip focused) |
| j/k | Previous/next job in stage (or pipeline when strip focused) |
| Enter | On strip: **no focus change** (pipeline already selected via j/k). On job: **open log** |
| Esc | Close log if open; else focus projects / leave board |
| r | Refresh open project graph (user load) |
| o | Open focused pipeline/job web_url |
| f | Toggle log follow (only when log open) |

## Help

`?` still shows full table including 002 graph keys.
