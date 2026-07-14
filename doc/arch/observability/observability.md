# Observability Strategy

How ciview is observed: which signals exist, how they are named, and where
they go. ciview is primarily a **local TUI**; production “service” telemetry is
optional. Local operator visibility comes first.

## Signals

- **Metrics** — optional counters/histograms for API calls and poll cycles (future).
- **Logs** — structured logs on stderr (or file if configured); primary signal in MVP.
- **Traces** — not required for MVP; may wrap GitLab HTTP client later.

## Metrics

When enabled, name metrics after the thing measured (e.g.
`gitlab.api.request.duration`), not after a team. Prefer histograms for latency,
counters for throughput. Every metric documents its unit.

MVP may emit **no custom metrics**; logs alone are acceptable.

## Logs

- Structured key/value (JSON or logfmt).
- Levels: error (API/auth failures), warn (retryable), info (session start,
  project focus), debug (poll ticks).
- **Never** log token values, `Authorization` headers, or full `.env` contents.
- Prefer redacting query strings that might carry private tokens.

## Tracing

Optional. If added: one span family around GitLab HTTP requests with attributes
`gitlab.host`, `http.route` (path template), `http.status_code` — never the raw
token.

## Cardinality

Bounded label sets only. Never use `user_id`, `request_id`, `session_id`,
`email`, `uuid`, project path with unbounded cardinality explosion, or job id as
metric labels at high cardinality without aggregation.

No custom metric labels.

## OTLP Conventions

If OTLP export is enabled later: gRPC 4317 or HTTP 4318; resource attribute
`service.name = "ciview"`. Default MVP: no OTLP exporter required.
