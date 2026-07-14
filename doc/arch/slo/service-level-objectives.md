# Service Level Objectives

## Scope

Applies to local `ciview` TUI on operator workstations using glab credentials and
GitLab REST ` /api/v4 ` over HTTPS. Not a multi-region service SLA.

## Error Budget Policy

| Rule | Detail |
|------|--------|
| Release gate | Ship only if `speckit validate`, `speckit verify`, `bun test` exit `0` |
| Zero-tolerance | RECENT reorder on cursor move; loading flash on silent poll |
| Auth closed | Missing glab always exit `2` with install+login steps |
| Shell-safe quit | Ctrl+C / `q` / SIGTERM leave parent shell usable (FR-27 / P12) |
| Response | Fix correctness SLOs before polish; exceptions need ADR under `doc/arch/adr/` |

## SLO-availability

| ID | Target | Measure |
|----|--------|---------|
| A1 | ≥99% starts reach TUI when glab ok | smoke `bun run start` |
| A2 | 100% fail-closed without glab | exit `2` |

## SLO-latency

| ID | Target | Measure |
|----|--------|---------|
| L1 | ≤2s p95 open project→pipelines | Enter → strip ready |
| L2 | ≤1 frame board nav | keypress → highlight |
| L3 | ≤2s p95 open job log | Enter job → first lines |

## SLO-correctness

| ID | Target | Measure |
|----|--------|---------|
| C1 | 100% stable RECENT under j/k | unit `src/ciview/nav/openProject.test.ts` |
| C2 | 100% silent poll no loading | handlers `silent`/`band=poll` |
