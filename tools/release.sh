#!/bin/sh
# Cuts a release: stamps the version into package.json and CHANGELOG.md, runs every
# check, then makes a release commit and an annotated tag. Nothing is pushed.
#
#   tools/release.sh
#
# Versions are the release date (UTC, like every commit and tag here): 2026.11.21. More
# releases the same day get a number: 2026.11.21-1, 2026.11.21-2, ... The script works the
# version out from today's date and the tags so far. (To force one: tools/release.sh 2026.11.21-5)
# Optional: RELEASE_TRAILER="Co-Authored-By: ..." adds a trailer line to the commit message.
set -eu

cd "$(git rev-parse --show-toplevel)"
export TZ=UTC
DATE=$(date +%F)

VERSION=${1:-}
if [ -z "$VERSION" ]; then
  # No leading zeros (2026.12.3, not 2026.12.03): npm rejects them.
  BASE=$(date +'%Y %m %d' | awk '{ printf "%d.%d.%d", $1, $2, $3 }')
  VERSION=$BASE
  n=0
  while git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; do
    n=$((n + 1))
    VERSION="$BASE-$n"
  done
fi
SEMVER='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
if ! printf '%s' "$VERSION" | grep -Eq "$SEMVER"; then
  echo "usage: tools/release.sh [version]   (default: today's date, e.g. 2026.11.21 or 2026.11.21-1)" >&2
  exit 2
fi
TAG="v$VERSION"

if [ -n "$(git status --porcelain)" ]; then
  echo "release: commit or stash your changes first (the working tree must be clean)." >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "release: tag $TAG already exists." >&2
  exit 1
fi

undo() {
  echo "release: a step failed; restoring package.json, package-lock.json and CHANGELOG.md." >&2
  git checkout -- package.json package-lock.json CHANGELOG.md
}
trap undo EXIT

npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
node tools/stamp-changelog.ts "$VERSION" "$DATE"
npx prettier --write CHANGELOG.md >/dev/null

echo "release: running checks, build, and end-to-end tests…"
npm run check
npm run build
npm run e2e

git add package.json package-lock.json CHANGELOG.md
if [ -n "${RELEASE_TRAILER:-}" ]; then
  git commit -q -m "chore(release): $TAG" -m "$RELEASE_TRAILER"
else
  git commit -q -m "chore(release): $TAG"
fi
git tag -a "$TAG" -m "水餃 Shuǐjiǎo $TAG"
trap - EXIT

tools/check-commits.sh
echo "release: created commit and tag $TAG (not pushed)."
echo "release: publish with: git push --follow-tags"
