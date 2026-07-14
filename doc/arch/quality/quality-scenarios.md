# Quality Scenarios

ATAM-style quality-attribute scenarios for ciview, mapped to ISO/IEC 25010:2023
characteristics. `speckit validate` scans the table below.

| ID | Attribute | Stimulus | Environment | Response | Measure |
|----|-----------|----------|-------------|----------|---------|
| QS-01 | functional-suitability | developer opens ciview and drills project → pipeline → job → log | authenticated against GitLab with valid token | panes show consistent CI data for the selection | Gherkin CI navigation scenarios pass |
| QS-02 | performance-efficiency | user switches project in the sidebar | membership of ≤100 projects, normal network | pipelines pane populates without multi-second full freezes | first pipelines page interactive within 2s on LAN to self-hosted GitLab |
| QS-03 | compatibility | client calls GitLab REST API v4 | self-hosted GitLab (e.g. git.eonf.ltd) or gitlab.com | list pipelines/jobs/trace succeeds with documented endpoints | contract smoke tests against API shapes pass |
| QS-04 | interaction-capability | first-time user with glab already configured runs `ciview` | supported terminal ≥80 columns | user reaches job list without reading external docs | keyboard legend visible; core path completable in review |
| QS-05 | reliability | GitLab API returns 5xx or times out during poll | live poll while pipeline running | last good snapshot retained; error banner; poll retries with backoff | no crash; recovery on next successful poll |
| QS-06 | security | process env lacks token and glab has no host token | cold start | app refuses to call API and shows clear auth error | no unauthenticated API spam; no token written to disk by ciview |
| QS-07 | maintainability | developer changes GitLab client mapping for jobs | Bun TypeScript codebase under CI | change stays in client/types modules | unrelated TUI panes need no edit; typecheck green |
| QS-08 | flexibility | operator runs ciview on macOS arm64 with Bun | supported platform matrix (macOS/Linux + Bun) | app runs from published install path | one codebase; platform-specific code minimized |
| QS-09 | safety | user has write-capable PAT but uses MVP view | normal operation | MVP performs only read GET APIs for CI view | no retry/cancel/play invoked without a future feature + confirm |
| QS-10 | reliability | operator sends SIGTERM or presses Ctrl+C / `q` | long-lived TUI with live poll + queue | process runs ordered FR-27 teardown: cleanup → full destroy → restoreTerminalTty → exit 0; parent shell remains usable (no CSI-u garbage / alt-screen residue) | unit tests shutdown + terminalRestore; Speckit `shutdown-flow.md` + FR-27; SIGKILL documented uncatchable |
| QS-11 | functional-suitability | new pipeline created while operator views older pipeline with live on | open project, all prior pipelines terminal | strip gains the new pipeline within one poll interval; selection stays on previous pipeline | FR-08b; poll policy tests; silent LoadPipelines does not auto-select |
