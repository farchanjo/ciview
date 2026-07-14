# Tasks: GitLab CI TUI Cockpit (001)

## Task Breakdown

### Scaffold

- [ ] T001 Create Bun package root: `package.json`, `tsconfig.json`, `bunfig.toml`, update `.gitignore` for Bun artifacts.
- [ ] T002 Add Makefile targets: `build`, `test`, `check` delegating to Bun + `speckit validate`.
- [ ] T003 Pin OpenTUI deps (`@opentui/core` + Solid or React binding) and document version in plan/README.

### Runtime core (queue / workers / observers) — before UI network

- [ ] T004 Implement `src/state/store.ts` with immutable-ish updates and `subscribe`/`notify` observers.
- [ ] T005 Implement `src/runtime/jobs.ts` job kinds, payloads, priorities, resource keys.
- [ ] T006 Implement `src/runtime/queue.ts`: enqueue, priority, coalesce-by-key, generation/abort hooks.
- [ ] T007 Implement `src/runtime/worker-pool.ts`: N async Bun workers consuming the queue.
- [ ] T008 Unit tests: coalesce, priority, abort drops stale results, worker applies to store.

### Auth & GitLab client (handlers only)

- [ ] T009 Implement `src/auth/resolve.ts` (env then glab config) with unit tests and fixture YAML.
- [ ] T010 Implement `src/gitlab/types.ts` + `map.ts` for project/pipeline/job/stage grouping.
- [ ] T011 Implement `src/gitlab/client.ts` (projects, pipelines, jobs, bridges, trace) with injectable `fetch`.
- [ ] T012 Implement handlers: LoadProjects, LoadPipelines, LoadJobs, LoadTrace, RefreshVisible, SavePrefs.
- [ ] T013 Implement `src/git/remote.ts` for `path/with/namespace` from git remote.
- [ ] T014 Implement `src/config/prefs.ts` + SavePrefs path; never store PAT.

### Poll

- [ ] T015 Implement `src/poll/timer.ts`: interval only enqueues RefreshVisible when live+active.

### TUI (observe + dispatch only)

- [ ] T016 Bootstrap OpenTUI shell + status bar + pane focus; keys map to intents/dispatch.
- [ ] T017 ProjectSidebar observing store (filter, pin → SavePrefs job, pulse).
- [ ] T018 PipelineList observing store; selection enqueues LoadJobs path.
- [ ] T019 JobTree by stage with glyphs; selection enqueues LoadTrace.
- [ ] T020 DetailLog from store trace window; follow mode local + poll-driven reloads.
- [ ] T021 Open-in-browser + narrow-terminal pane collapse.

### CLI & polish

- [ ] T022 CLI entry `src/main.ts`: default, `.`, path; start queue/workers; initial LoadProjects.
- [ ] T023 Empty/error banners from store error slices; quit drains/stops workers.
- [ ] T024 Unit tests for sanitizeTrace, stage grouping, handler mapping; `bun run check` green.
- [ ] T025 Manual smoke (glab auth): navigate + live update without UI freeze.
- [ ] T026 README run docs; `speckit validate` 0 findings.

## Dependencies

- T004–T008 before real handlers in the pool.
- T009–T014 before T015–T021 useful end-to-end.
- Network only for T025; queue tests fully offline.
- Bun required for all runtime/tests.

## Order

T001–T003 → T004–T008 → T009–T014 → T015 → T016–T021 → T022–T026.
