---
status: accepted
date: 2026-07-14
deciders: [farchanjo]
consulted: []
informed: []
---

# ADR-0003: TypeScript + React OpenTUI frontend

## Context and Problem Statement

ciview’s UI is a multi-pane terminal cockpit. OpenTUI supports multiple
bindings. We need a single, non-negotiable frontend stack so implementation and
specs do not oscillate between Solid and React.

## Decision Drivers

- One language everywhere: **TypeScript**
- Familiar component model for the operator/author
- First-class OpenTUI support path for React
- Fits store/RxJS observation (ADR-0002)

## Considered Options

- **A.** OpenTUI + **React** + TypeScript (chosen)
- **B.** OpenTUI + Solid + TypeScript
- **C.** Imperative `@opentui/core` only without a component reconciler

## Decision Outcome

Chosen option: **A**.

| Layer | Choice |
|-------|--------|
| Language | **TypeScript** (strict) for all app code |
| UI reconciler | **React** via OpenTUI React bindings (`@opentui/react` or current package name at implement time) |
| Core TUI | `@opentui/core` as required by the React binding |
| State → UI | Store observers and/or **RxJS** → React props/state (ADR-0002) |
| Runtime | Bun |

### Rules

1. No second UI framework (no Solid, no Ink as primary).
2. No plain JS source files for product code — TypeScript only.
3. UI components live under `src/ui/**` and only **dispatch** intents / **observe**
   state; they do not call the GitLab client.

### Consequences

- Good: clear hiring/mental model; aligns with React ecosystem patterns.
- Good: pairs with RxJS if streams feed hooks or thin adapters.
- Bad: must track OpenTUI React package maturity; pin versions and isolate
  binding churn in `src/ui/**`.

## Relationship

- Complements ADR-0001 (product/stack) and ADR-0002 (async runtime).
