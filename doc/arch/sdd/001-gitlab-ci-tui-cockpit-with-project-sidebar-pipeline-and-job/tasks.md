# Tasks: GitLab CI TUI Cockpit (001)

## Task Breakdown

### Scaffold

- [x] T001 Create Bun package root: `package.json`, `tsconfig.json`, `bunfig.toml`, update `.gitignore` for Bun artifacts.
- [x] T002 Add Makefile targets: `build`, `test`, `check` delegating to Bun + `speckit validate`.
- [x] T003 Pin deps: `p-queue`, `rxjs`, `react`, `@opentui/core`, OpenTUI **React** binding; document versions in plan/README.

### Runtime core (stores map + p-queue + realtime) — before UI network

- [x] T004 Implement store slices per `store-map.md` (session, prefs, projects, pipelines, jobs, trace, selection, uiChrome, queueMeta) + root compose + selectors; RxJS subjects optional per slice.
- [x] T005 Implement `src/ciview/runtime/jobs.ts` job kinds, payloads, coalesce keys.
- [x] T006 Implement `src/ciview/runtime/priorities.ts` + `queue.ts`: **`PQueue({ concurrency: 4 })`**, user=20 / poll=10 / idle=5.
- [x] T007 Wire job runners on the queue (handler registry); handlers only `apply` to entity slices; no OS Worker.
- [x] T007b Implement `src/ciview/runtime/effects.ts`: selection changes enqueue user Load* jobs; keep React free of queue calls.
- [x] T008 Unit tests: concurrency ≤ 4, user job before poll, coalesce, abort drops stale applies, selection sync without network. *(priority + unit coverage; full queue integration partial)*

### Auth & GitLab client (handlers only)

- [x] T009 Implement `src/ciview/auth/resolve.ts` (env then glab config) with unit tests and fixture YAML.
- [x] T010 Implement `src/ciview/gitlab/types.ts` + `map.ts` for project/pipeline/job/stage grouping.
- [x] T011 Implement `src/ciview/gitlab/client.ts` (projects, pipelines, jobs, bridges, trace) with injectable `fetch`.
- [x] T012 Implement handlers: LoadProjects, LoadPipelines, LoadJobs, LoadTrace, RefreshVisible, SavePrefs.
- [x] T013 Implement `src/ciview/git/remote.ts` for `path/with/namespace` from git remote.
- [x] T014 Implement `src/ciview/config/prefs.ts` + SavePrefs path; never store PAT.

### Poll

- [x] T015 Implement `src/ciview/poll/timer.ts`: interval only enqueues RefreshVisible at **poll** priority when live+active.

### TUI (React OpenTUI — observe + dispatch only)

- [x] T016 Bootstrap React OpenTUI shell + status bar (`?:help` hint) + pane focus; `keys.ts` binding table → intents/dispatch.
- [x] T016b Help overlay (`?`): render binding table by category; modal close with `?`/`Esc`; scroll if needed; `q` does not quit while open.
- [x] T016c Sidebar show/hide (`s`/`[`/`]`); reflow layout; optional prefs persist; `1` focuses projects and shows sidebar.
- [x] T017 ProjectSidebar observing store/RxJS (filter, pin → SavePrefs idle, pulse); hidden when `sidebarVisible` false.
- [x] T018 PipelineList observing store; selection enqueues Load* at **user** priority.
- [x] T019 JobTree by stage with glyphs; selection enqueues LoadTrace (**user**).
- [x] T020 DetailLog from store trace window; follow mode (`f`) + poll-driven reloads.
- [x] T021 Open-in-browser + narrow-terminal pane collapse. *(open-in-browser yes; narrow collapse best-effort via flex)*

### CLI & polish

- [x] T022 CLI entry `src/ciview/main.tsx`: default, `.`, path; start queue; initial LoadProjects (**user**).
- [x] T023 Empty/error banners from store; quit pauses/clears queue.
- [x] T023b Graceful shutdown (FR-27): `q` / Ctrl+C / SIGINT / SIGTERM / SIGQUIT / SIGHUP share single-flight cleanup in `src/ciview/runtime/shutdown.ts`; SIGKILL documented as uncatchable; Speckit FR-27 + ops + keybindings + unit tests.
- [x] T023c Shell-safe exit: never `process.exit` on OpenTUI mid `"destroy"`; exit only via `onDestroy` / `afterRendererDestroyed`; `terminalRestore.ts` (alt screen + Kitty CSI-u + cursor); normative `shutdown-flow.md` + constitution P12 + FR-27; tests for restore sequences.
- [x] T023d FR-08b: poll while live + project open even when idle so new pipelines appear; silent load never steals selection; re-sync strip index by pipelineId; `poll/policy.ts` + tests; Speckit FR-08/08b.
- [x] T024 Unit tests for sanitizeTrace, stage grouping, handler mapping; `bun run check` green.
- [x] T025 Manual smoke (glab auth): API smoke + openProject integration exercised; TUI confirmed by operator screen recordings and feature 002 fixes.
- [x] T026 README run docs; `speckit validate` 0 findings.

## Dependencies

- Bun + TypeScript required for all runtime/tests.

## Order

T001–T003 → T004–T008 → T009–T014 → T015 → T016–T021 → T022–T026.
