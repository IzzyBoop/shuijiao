#!/bin/sh
# Cuts a release: stamps the version into package.json and CHANGELOG.md, runs every
# check, then makes a release commit and an annotated tag. Nothing is pushed.
#
#   tools/release.sh 0.1.0-beta.2
#
# Versions follow Semantic Versioning: 0.1.0-beta.1, 0.1.0-beta.2, ... then 0.1.0, 0.2.0, ...
# Optional: RELEASE_TRAILER="Co-Authored-By: ..." adds a trailer line to the commit message.
set -eu

VERSION=${1:-}
SEMVER='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
if ! printf '%s' "$VERSION" | grep -Eq "$SEMVER"; then
  echo "usage: tools/release.sh <version>   e.g. 0.1.0-beta.2" >&2
  exit 2
fi
TAG="v$VERSION"

cd "$(git rev-parse --show-toplevel)"
export TZ=UTC

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

DATE=$(date -u +%F)
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
node tools/stamp-changelog.ts "$VERSION" "$DATE"
npx prettier --write CHANGELOG.md >/dev/null

echo "release: running checks, build and end-to-end tests…"
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
