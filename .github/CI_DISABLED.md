# GitHub Actions CI is DISABLED

**ciview does not use GitHub Actions for build, test, or release.**

All binaries are produced **locally**:

| Platform | Where |
|----------|--------|
| macOS (darwin-arm64/x64) | Developer Mac (`make build-darwin`) |
| Linux x86_64 | SSH builder `root@vm.services` (`make build-linux`) |

Release flow (preferred — one command):

```bash
make ship                 # bump + check + binaries + tag + push + gh release
make ship PART=minor
make ship PART=1.2.0
```

Piecewise:

```bash
make bump PART=patch
make check
make release-binaries   # darwin + linux + SHA256SUMS
make release            # tag current version + gh upload of *local* artifacts
```

Scripts: `scripts/ship.sh`, `scripts/bump-version.mjs`.

Do **not** add `on: push` / `on: pull_request` workflows that compile or test
this repo until an explicit project decision re-enables CI.

If a workflow file is added by mistake, delete it or set `if: false` on every job.
