#!/usr/bin/env bash
# Point this clone at versioned hooks under githooks/ (core.hooksPath).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x githooks/pre-commit githooks/commit-msg githooks/pre-push 2>/dev/null || true
git config core.hooksPath githooks

# Verify
HOOKS_PATH="$(git config --get core.hooksPath || true)"
echo "git hooks installed: core.hooksPath=$HOOKS_PATH"
ls -la githooks/
echo ""
echo "Active hooks: pre-commit, commit-msg, pre-push"
echo "Skip once:  SKIP_HOOKS=1 git commit ... / git push ..."
echo "Uninstall:  git config --unset core.hooksPath"
