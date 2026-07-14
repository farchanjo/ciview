# UX layout — feature 003 (adaptive + smart log)

## Board (log closed)

Same zones as 002; **sizes from LayoutBudget(termW, termH, …)**.

```text
┌─ Status (budget.statusRows) ───────────────────────────────────────┐
├─ Projects (sidebarWidth) ─┬─ Pipeline graph ───────────────────────┤
│  …                        │  strip: stripRows                       │
│                           │  board: remaining height                │
│                           │  stage cols: stageColWidth each         │
└───────────────────────────┴─────────────────────────────────────────┘
```

## Board + log modal (log open)

Log is **overlay**, not a flex sibling:

```text
┌─ Status ────────────────────────────────────────────────────────────┐
├─ Sidebar ─┬─ Graph (unchanged geometry under modal) ───────────────┤
│           │                                                         │
│  ╔════════╧══════════════════════════════════════════════════════╗  │
│  ║ Job log modal (budget.logModal)                               ║  │
│  ║ meta · mode · error hit                                       ║  │
│  ║ [contentRows lines of classified view]                        ║  │
│  ║ footer rows range                                             ║  │
│  ╚═══════════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────────┘
```

## Density tiers (height)

| termHeight | density      | stripRows | log contentRows (approx) |
|-----------:|--------------|----------:|--------------------------|
| < 20       | compact      | ≤ 2       | max(6, 0.85h − chrome)   |
| 20–34      | normal       | 2–3       | ~0.9h − chrome           |
| ≥ 35       | comfortable  | 3–5       | ~0.92h − chrome          |

## Width tiers

| termWidth | sidebar (if visible) | notes                          |
|----------:|----------------------|--------------------------------|
| < 100     | auto-hide unless force | FR-12 / FR-42               |
| 100–139   | ~24–28               | tighter stage cols              |
| ≥ 140     | ~28–32 (cap 32)      | wider job names                |

## Anti-patterns

- Fixed `height: 16` drawer under `height: 100%` graph
- Magic numbers for visible log lines unrelated to termHeight
- Paint bleed / nested boxes overflowing adjacent zones
- Always-visible log column (still forbidden from 002)
