# Deploy Runbook — ciview

Operational procedure to build, validate, and ship ciview from a clean checkout.
ciview is a **local Bun CLI/TUI**; “deploy” means release a versioned binary or
package consumers can install, not a long-running server fleet.

## Purpose

Build, test, validate specs, and publish a release artifact (npm/Bun package
and/or compiled binary when configured).

## Trigger

- A release tag is requested.
- Main branch has merged approved feature work ready to ship.

## Preconditions

- Clean working tree on the intended release commit.
- Tooling available: `bun`, `git`, `speckit`; network access to the package
  registry when `bun install` must fetch dependencies.
- No secrets in the tree (`speckit validate` / manual review of `.env`).

## Steps

1. Sync: `git fetch --all` and check out the release commit.
2. Spec gate: `speckit validate` — must exit `0`.
3. Install: `bun install`.
4. Typecheck/tests: `bun run check` (or project-equivalent from Makefile/package.json).
5. Build: `bun run build` producing the distributable entrypoint.
6. Optional: tag `vX.Y.Z` and push tag per release policy.
7. Publish artifact only after steps 2–5 succeed.

## Verification

- `speckit validate` exits `0`.
- `bun run check` (tests + types) passes.
- Running the built `ciview --help` (or `bun run start -- --help`) shows CLI help.
- Auth smoke (optional, private): against a test project, list pipelines succeeds.

## Rollback

1. Stop publishing; do not overwrite a bad latest tag without a new version.
2. Check out previous known-good tag.
3. Re-run `speckit validate` and `bun run check`.
4. Record failure and open a follow-up issue/feature before the next attempt.

## Incident: bad token / auth outage

1. Confirm `glab auth status` or `GITLAB_TOKEN` / host env.
2. Prefer rotating to a **read_api** (or minimal) token for view-only use.
3. Restart ciview; do not paste tokens into issues or commits.
