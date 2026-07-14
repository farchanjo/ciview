# Observability Strategy

Local TUI observability for `ciview` (`service.name` target `ciview`).

## Signals

| Family | MVP | Notes |
|--------|-----|-------|
| Metrics | optional | table below |
| Logs | required | structured stderr |
| Traces | optional | HTTP client spans later |

## Metrics

| Metric | Type | Unit | Labels |
|--------|------|------|--------|
| `ciview.gitlab.request.duration` | histogram | ms | `route` ∈ {projects,pipelines,jobs,trace}; `status_class` ∈ {2xx,4xx,5xx} |
| `ciview.poll.cycle` | counter | 1 | `outcome` ∈ {ok,skip_idle,error} |
| `ciview.queue.inflight` | gauge | 1 | (none) |
| `ciview.ui.open_project` | counter | 1 | (none) |
| `ciview.ui.open_job_log` | counter | 1 | (none) |

No labels for project path, user id, job id, email, uuid, session id.

## Logs

| Level | Events |
|-------|--------|
| error | auth fail class, HTTP ≥500 |
| warn | HTTP 429/timeout |
| info | session start host, openProject id |
| debug | poll tick interval |

Never log tokens, `Authorization`, or full traces. Format: logfmt or JSON.

## Tracing

Optional span: `gitlab.http` with `gitlab.host`, `http.route` template, `http.status_code`.

## Cardinality

Bounded sets only. No `user_id` / `request_id` / `session_id` / `email` / `uuid` metric labels.

No custom metric labels.

## OTLP Conventions

Optional export: OTLP gRPC `:4317` or HTTP `:4318`. Resource: `service.name=ciview`. Default: off.
