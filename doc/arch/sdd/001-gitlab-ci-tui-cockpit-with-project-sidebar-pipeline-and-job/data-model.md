# Data Model — GitLab CI TUI Cockpit

Aligned with
`doc/arch/schemas/gitlab-ci-tui-cockpit-with-project-sidebar-pipeline-and-job.cue`
and the runtime **store map** in `store-map.md`.

## Interactive realtime CLI

ciview is not a one-shot CLI printer. It is a long-lived **interactive
realtime** process: keyboard in, store emissions out, panes always bound to
stores. Domain entities below are what **entity slices** hold after job
handlers apply API results.

## Entities

| Entity | Identity | Notes |
|--------|----------|-------|
| Project | `id` | `pathWithNamespace`, pin flag, optional `pulseStatus` |
| Pipeline | `id` (+ `projectId`) | ref, sha, status, source, webUrl, duration |
| Job | `id` (+ `pipelineId`) | name, stage, status, allowFailure, duration |
| StageGroup | `name` within pipeline | ordered list of job ids |
| AuthConfig | session | host + tokenSource (token only in memory, not in store dumps) |
| Selection | session | projectId / pipelineId / jobId + generations |
| UiChrome | session | focused pane, cursors, filters, logFollow |
| SliceStatus | per entity slice | `idle` \| `loading` \| `ready` \| `error` \| `stale` |

## Relationships

```
Project 1──* Pipeline
Pipeline 1──* Job
Pipeline 1──* StageGroup (derived)
StageGroup 1──* Job id (partition by stage; jobs live in jobsStore)
selection → project → pipeline → job (master–detail)
```

## Store slices (summary)

See `store-map.md` for full write/observe matrix.

| Slice | Entities / fields |
|-------|-------------------|
| session | host, tokenSource, ready, fatalError |
| prefs | pins, pollIntervalMs, live default |
| projects | Project[], SliceStatus |
| pipelines | Pipeline[], scoped projectId, SliceStatus |
| jobs | Job[], stages, scoped pipelineId, SliceStatus |
| trace | line window, scoped jobId, SliceStatus |
| selection | ids + generations |
| uiChrome | focus, cursors, filters, follow |
| queueMeta | inflight, last errors (optional) |

## Derived fields

- `StageGroup[]` from jobs sorted by pipeline stage order then name
- `failedJobName` on pipeline from first failed non-allow_failure job when jobs loaded
- `live` effective = user toggle AND any active status in selection/visible set
- `stale` on a slice after selection change until the matching user-priority job applies

## Persistence

| Data | Where |
|------|--------|
| pins[], pollIntervalMs | XDG ciview prefs file via SavePrefs job |
| token | never on disk via ciview (env/glab only) |
| entity slices + selection + chrome | memory only (realtime session) |
