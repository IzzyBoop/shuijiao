#!/bin/sh
# Fails if the history being published (this branch and all tags) has a commit or
# annotated tag with a personal email or a non-UTC time zone. Runs in CI; the local
# pre-commit hook covers new commits.
set -eu

# Your GitHub no-reply address, plus GitHub's own (web UI and bot) no-reply addresses.
ALLOWED='43628079+IzzyBoop@users.noreply.github.com noreply@github.com 49699333+dependabot[bot]@users.noreply.github.com 41898282+github-actions[bot]@users.noreply.github.com'

bad=$(git log HEAD --tags --format='%H %ae %ce %ad %cd' --date=format:%z | awk -v ok="$ALLOWED" '
  BEGIN { n = split(ok, list, " "); for (i = 1; i <= n; i++) allowed[list[i]] = 1 }
  !($2 in allowed) || !($3 in allowed) || $4 != "+0000" || $5 != "+0000" { print }')

# Annotated tags carry their own tagger name, email, and date.
badtags=$(git for-each-ref refs/tags --format='%(objecttype) %(refname:short) %(taggeremail) %(taggerdate:format:%z)' |
  awk '$1 == "tag" && ($3 != "<43628079+IzzyBoop@users.noreply.github.com>" || $4 != "+0000") { print }')

if [ -n "$bad" ] || [ -n "$badtags" ]; then
  echo "check-commits: commits or tags with a personal email or non-UTC time offset:" >&2
  [ -n "$bad" ] && echo "$bad" >&2
  [ -n "$badtags" ] && echo "$badtags" >&2
  exit 1
fi
echo "check-commits: $(git rev-list HEAD --tags | sort -u | wc -l | tr -d ' ') commits and $(git tag | wc -l | tr -d ' ') tags clean."
