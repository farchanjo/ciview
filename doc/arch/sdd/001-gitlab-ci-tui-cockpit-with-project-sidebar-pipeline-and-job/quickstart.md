# Quickstart — ciview (feature 001)

## Prerequisites

- Bun ≥ 1.1
- `speckit` (optional for contributors following SDD)
- GitLab personal access token with at least `read_api`
- Optional: `glab` logged in (`glab auth status`)

## Auth (glab only)

```bash
# 1) Install if needed
brew install glab

# 2) Authenticate
glab auth login
glab auth status
```

ciview refuses to start without glab + a logged-in host token. It prints
numbered install / authenticate steps when something is missing.

## Run (once implemented)

```bash
cd /path/to/ciview
bun install
bun run start
# or
bun run src/main.ts
bun run src/main.ts .
bun run src/main.ts infra/csseed
```

## Smoke checklist

1. Sidebar shows projects
2. Select project → pipelines load
3. Select pipeline → jobs by stage
4. Select running/failed job → log visible
5. `o` opens browser URL
6. Quit with `q`

## Spec gates

```bash
speckit status
speckit validate
```
