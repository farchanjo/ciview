# Deploy Runbook — ciview

Operational procedure to build a **standalone Mach-O binary**, Apple-codesign
it, and install into `/usr/local/bin` with `sudo`. ciview is a local Bun
CLI/TUI — not a multi-node fleet.

## Purpose

1. Compile a single-file executable (`bun build --compile`).
2. Sign with **Apple `codesign`** (ad-hoc or Developer ID).
3. Install to **`/usr/local/bin/ciview`** via `sudo`.

## Trigger

- Workstation install / upgrade of the local `ciview` binary.
- A release tag is requested and the binary must be rebuilt.

## Preconditions

- macOS with `bun`, `codesign`, `sudo`, `make`.
- Clean enough tree; `bun install` already run.
- Optional: Apple Developer identity for non-ad-hoc signing:
  `security find-identity -v -p codesigning`

## Steps

### A — Local workstation install (macOS)

1. Ensure tooling: `bun`, `make`, `codesign`, `sudo` on PATH; run `bun install`.
2. Optional quality gate: `make check` (tests + typecheck + lint + `speckit validate`).
3. Compile the standalone binary: `make build` → `dist/ciview`.
4. Apple-codesign the binary: `make sign` (default identity ad-hoc `-`).
5. Install with sudo and re-sign the installed path: `make install`
   (copies to `/usr/local/bin/ciview`).
6. Or run the combined path: `make deploy` (build + sign + install).
7. Optional Developer ID:  
   `make deploy CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"`.  
   Default ad-hoc is enough for the same machine; shipping outside your Mac
   needs Developer ID (+ notarization, out of scope here).
8. Uninstall when needed: `make uninstall` (`sudo rm /usr/local/bin/ciview`).

### B — Multi-arch GitHub Release (no GitHub Actions CI)

**GitHub Actions is disabled** (`.github/CI_DISABLED.md`). Never compile in GHA.

1. `make check` on the developer Mac.
2. `make release-binaries` which:
   - builds **darwin** locally (`make build-darwin`);
   - rsyncs sources to **`root@vm.services`** and builds **linux-x64** natively
     (`make build-linux` — required for OpenTUI native packages);
   - writes `dist/release/SHA256SUMS`.
3. `make release VERSION=vX.Y.Z` which tags, pushes, and runs
   `gh release create` uploading **only local** artifacts from `dist/release/`.
4. Confirm release assets on GitHub; do not attach CI-built binaries.

## Verification

| Check | Command |
|-------|---------|
| Binary exists | `test -x /usr/local/bin/ciview` |
| Help works | `ciview -h` |
| Signature | `codesign -dv /usr/local/bin/ciview` |
| Spec / tests | `make check` |

## Rollback

1. `make uninstall` or restore previous binary.
2. Check out known-good commit; `make deploy` again.
3. Record failure before the next attempt.

## Incident: bad token / auth outage

1. Confirm `glab auth status` (ciview is glab-only for credentials).
2. Prefer a minimal read token in glab; do not paste tokens into issues.
3. Restart `ciview` after auth is fixed.

## Incident: Gatekeeper / codesign

1. Prefer re-sign: `make sign install`.
2. Ad-hoc binary is intended for the build machine; do not distribute ad-hoc
   builds as “official” releases.
3. After a forced `kill -9` of a running TUI, run `reset` if the tty is dirty
   (unrelated to install; see FR-27).
