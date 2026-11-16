#!/bin/sh
# Fails if any commit or annotated tag leaks a personal email or a non-UTC time zone.
# Runs in CI on the full history (the local pre-commit hook covers new commits).
set -eu

ALLOWED_EMAIL="43628079+IzzyBoop@users.noreply.github.com"
ALLOWED_EXTRA="noreply@github.com" # commits made through the GitHub web UI

bad=$(git log --all --format='%H %ae %ce %ad %cd' --date=format:%z | awk -v a="$ALLOWED_EMAIL" -v b="$ALLOWED_EXTRA" '
  ($2 != a && $2 != b) || ($3 != a && $3 != b) || $4 != "+0000" || $5 != "+0000" { print }')

# Annotated tags carry their own tagger name, email, and date.
badtags=$(git for-each-ref refs/tags --format='%(objecttype) %(refname:short) %(taggeremail) %(taggerdate:format:%z)' |
  awk -v a="<$ALLOWED_EMAIL>" '$1 == "tag" && ($3 != a || $4 != "+0000") { print }')

if [ -n "$bad" ] || [ -n "$badtags" ]; then
  echo "check-commits: commits or tags with a personal email or non-UTC time offset:" >&2
  [ -n "$bad" ] && echo "$bad" >&2
  [ -n "$badtags" ] && echo "$badtags" >&2
  exit 1
fi
echo "check-commits: $(git rev-list --all --count) commits and $(git tag | wc -l | tr -d ' ') tags clean."
