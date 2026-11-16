#!/bin/sh
# Fails if any commit in the history leaks a personal email or a non-UTC time zone.
# Runs in CI on the full history (the local pre-commit hook covers new commits).
set -eu

ALLOWED_EMAIL="43628079+IzzyBoop@users.noreply.github.com"
ALLOWED_EXTRA="noreply@github.com" # commits made through the GitHub web UI

bad=$(git log --all --format='%H %ae %ce %ad %cd' --date=format:%z | awk -v a="$ALLOWED_EMAIL" -v b="$ALLOWED_EXTRA" '
  ($2 != a && $2 != b) || ($3 != a && $3 != b) || $4 != "+0000" || $5 != "+0000" { print }')

if [ -n "$bad" ]; then
  echo "check-commits: commits with a personal email or non-UTC time offset:" >&2
  echo "$bad" >&2
  exit 1
fi
echo "check-commits: $(git rev-list --all --count) commits clean."
