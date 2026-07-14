#!/usr/bin/env bash
# One-shot: bump version → check → multi-arch binaries → commit → tag → push → gh release
# GitHub Actions is never used (local assets only).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PART="${PART:-patch}"          # patch | minor | major | X.Y.Z
SKIP_CHECK="${SKIP_CHECK:-0}"  # 1 = skip make check
SKIP_COMMIT="${SKIP_COMMIT:-0}"
DRY_RUN="${DRY_RUN:-0}"
SSH_TARGET="${SSH_TARGET:-root@vm.services}"
export SSH_TARGET

die() { echo "error: $*" >&2; exit 1; }

command -v bun >/dev/null || die "bun not found"
command -v gh >/dev/null || die "gh not found"
command -v git >/dev/null || die "git not found"
command -v make >/dev/null || die "make not found"

# Working tree: allow only if we will commit the bump (and optional dirty with ALLOW_DIRTY=1)
if [[ -n "$(git status --porcelain)" && "${ALLOW_DIRTY:-0}" != "1" && "$SKIP_COMMIT" != "1" ]]; then
  # If only untracked/build noise is ok, still require clean for safety
  echo "warning: working tree not clean — continuing (ALLOW_DIRTY not set will still commit bump only if other changes staged carefully)"
  echo "status:"
  git status --short | head -40
  if [[ "${ALLOW_DIRTY:-0}" != "1" ]]; then
    die "clean the tree or set ALLOW_DIRTY=1 to ship with extra changes"
  fi
fi

echo "==> bump ($PART)"
NEW_RAW="$(bun "$ROOT/scripts/bump-version.mjs" "$PART")"
VERSION="v${NEW_RAW}"
echo "    version → $VERSION"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1 — would: check, release-binaries, commit, tag $VERSION, push, gh release"
  # restore package.json? leave bumped for inspection
  exit 0
fi

if [[ "$SKIP_CHECK" != "1" ]]; then
  echo "==> make check"
  make check
else
  echo "==> SKIP_CHECK=1"
fi

echo "==> make release-binaries (darwin local + linux via $SSH_TARGET)"
make release-binaries

DARWIN="$(ls "$ROOT/dist/release"/ciview-darwin-* 2>/dev/null | head -1 || true)"
LINUX="$ROOT/dist/release/ciview-linux-x64"
SUMS="$ROOT/dist/release/SHA256SUMS"
[[ -n "$DARWIN" && -f "$DARWIN" ]] || die "missing darwin binary in dist/release/"
[[ -f "$LINUX" ]] || die "missing $LINUX"
[[ -f "$SUMS" ]] || die "missing $SUMS"

if [[ "$SKIP_COMMIT" != "1" ]]; then
  echo "==> commit version bump"
  git add package.json
  if git diff --cached --quiet; then
    echo "    package.json already committed at $NEW_RAW"
  else
    git commit -m "chore: release ${VERSION}"
  fi
fi

if git rev-parse "$VERSION" >/dev/null 2>&1; then
  die "tag $VERSION already exists — bump further or delete tag"
fi

echo "==> tag $VERSION"
git tag -a "$VERSION" -m "ciview ${VERSION}"

echo "==> ensure origin"
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create farchanjo/ciview --public \
    --description "Terminal CI cockpit for GitLab — Bun + OpenTUI (local builds; no GHA CI)" \
    --source=. --remote=origin
fi

echo "==> push branch + tag"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git push -u origin "$BRANCH"
git push origin "refs/tags/${VERSION}"

NOTES="$(cat <<EOF
## ciview ${VERSION}

Local multi-arch build (**GitHub Actions CI is disabled**).

### Assets
- \`$(basename "$DARWIN")\` — macOS (Apple codesign)
- \`$(basename "$LINUX")\` — Linux x86_64 (built on ${SSH_TARGET})
- \`SHA256SUMS\`

### Install
\`\`\`bash
chmod +x $(basename "$DARWIN")
sudo mv $(basename "$DARWIN") /usr/local/bin/ciview
ciview -h
\`\`\`

Auth: \`glab auth login\` (glab-only).

Rebuild: \`make ship PART=patch\`
EOF
)"

echo "==> GitHub Release ${VERSION}"
if gh release view "$VERSION" >/dev/null 2>&1; then
  # Publish draft / re-upload assets
  gh release edit "$VERSION" --draft=false --latest --title "ciview ${VERSION}" --notes "$NOTES" || true
  gh release upload "$VERSION" "$DARWIN" "$LINUX" "$SUMS" --clobber
else
  gh release create "$VERSION" "$DARWIN" "$LINUX" "$SUMS" \
    --title "ciview ${VERSION}" \
    --notes "$NOTES" \
    --latest
fi

echo ""
echo "shipped ${VERSION}"
gh release view "$VERSION" --json url,tagName,isDraft,assets -q '{url,tagName,isDraft,assets:[.assets[].name]}'
