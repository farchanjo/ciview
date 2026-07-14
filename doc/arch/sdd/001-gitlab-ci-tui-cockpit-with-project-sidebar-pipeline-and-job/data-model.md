# Data Model — GitLab CI TUI Cockpit

Aligned with
`doc/arch/schemas/gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job.cue`.

## Entities

| Entity | Identity | Notes |
|--------|----------|-------|
| Project | `id` | `pathWithNamespace`, pin flag, optional `pulseStatus` |
| Pipeline | `id` (+ `projectId`) | ref, sha, status, source, webUrl, duration |
| Job | `id` (+ `pipelineId`) | name, stage, status, allowFailure, duration |
| StageGroup | `name` within pipeline | ordered list of job ids |
| AuthConfig | session | host + tokenSource (token only in memory) |
| CockpitState | singleton UI aggregate | selections, filters, poll, logFollow |

## Relationships

```
Project 1──* Pipeline
Pipeline 1──* Job
Pipeline 1──* StageGroup (derived)
StageGroup 1──* Job id (partition by stage; jobs live on CockpitState)
CockpitState *──? Project (selected)
CockpitState *──? Pipeline (selected)
CockpitState *──? Job (selected)
```

## Derived fields

- `StageGroup[]` from jobs sorted by pipeline stage order then name
- `failedJobName` on pipeline from first failed non-allow_failure job when jobs loaded
- `live` effective = user toggle AND any active status in selection/visible set

## Persistence

| Data | Where |
|------|--------|
| pins[], pollIntervalMs | `~/.config/ciview/config.json` |
| token | never on disk via ciview (env/glab only) |
| CockpitState | memory only |
