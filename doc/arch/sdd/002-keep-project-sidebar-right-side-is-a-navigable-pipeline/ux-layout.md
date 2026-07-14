# UX layout — feature 002

## Zones

```text
┌─ Status (1–2 lines): host · LIVE · loading? · ?:help ──────────────┐
├─ Projects (sidebar) ─┬─ Pipeline graph ────────────────────────────┤
│  title: smart 12/146 │  Pipeline strip (horizontal or short list)  │
│  / filter live       │  #6073 main ● running   #6072 main ✓        │
│  ── PINNED ──        │  ─────────────────────────────────────────  │
│  ── RECENT ──        │  Stage board (columns = stages)             │
│  ── MATCHES ──       │   build        test         deploy          │
│  (stable order on    │  ┌──────┐    ┌──────┐     ┌──────┐         │
│   j/k)               │  │build │    │ unit │     │ prod │         │
│                      │  │  ✓   │    │  ●   │     │  ·   │         │
│                      │  └──────┘    │ e2e  │     └──────┘         │
│                      │              │  ·   │                       │
│                      │              └──────┘                       │
│                      ├─ Job log (only if logOpen) ─────────────────┤
│                      │  job name · status · follow                 │
│                      │  [trace lines…]                             │
└──────────────────────┴─────────────────────────────────────────────┘
```

## Focus model

| Focus | Keys |
|-------|------|
| `projects` | j/k cursor; Enter open project; / filter; m scope; s hide |
| `pipeline_strip` | h/l or j/k change pipeline; Enter focus board |
| `stage_board` | h/l stage; j/k job; Enter open log |
| `job_log` | j/k scroll; f follow; Esc close log |

Tab cycles: projects → strip → board → (log if open) → …

## Loading

| Event | Loading UI |
|-------|------------|
| Enter project | graph zone: loading pipelines/jobs |
| Change pipeline | board: loading jobs |
| Enter job | log zone: loading trace |
| Live poll | silent (no loading flash) |

## Anti-patterns (forbidden)

- Reordering RECENT on j/k
- LoadPipelines on every project cursor move
- Always-visible log column stealing graph space
- Paint bleed / nested boxes overflowing into adjacent zones
