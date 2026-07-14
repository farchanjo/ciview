# Quickstart — ciview (feature 001)

## Prerequisites

- Bun ≥ 1.1
- `speckit` (optional for contributors following SDD)
- GitLab personal access token with at least `read_api`
- Optional: `glab` logged in (`glab auth status`)

## Auth

Option A — glab (preferred on this machine):

```bash
glab auth status
# host e.g. git.eonf.ltd with token present
```

Option B — env:

```bash
export GITLAB_HOST=https://git.eonf.ltd
export GITLAB_TOKEN=glpat-...   # read_api sufficient for MVP
```

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
