#!/bin/sh
# Find media in a PR or issue body that GitHub renders as a link instead of inline.
#   check-embeds.sh <body.md>   -> prints each offending line; exit 1 when there is one
# Passes: `![claim](https://….png|jpg|gif)` alone on its line, indented under a list item or not,
# `[Recording](https://….webm|mp4)` alone on its line, a sized `<img src="https://…" …>` alone on its line,
# and a table row of `![…](…)` cells. Everything else that names a media URL fails.
set -eu
body=${1:?usage: check-embeds.sh <body.md>}
bad=$(grep -nE 'https?://[^ )]+\.(png|jpe?g|gif|webm|mp4)\b' "$body" \
  | grep -vE '^[0-9]+: *!\[[^]]+\]\(https?://[^ )]+\.(png|jpe?g|gif)\)$' \
  | grep -vE '^[0-9]+: *\[Recording\]\(https?://[^ )]+\.(webm|mp4)\)$' \
  | grep -vE '^[0-9]+: *<img src="https?://[^"]+\.(png|jpe?g|gif)"[^>]*>$' \
  | grep -vE '^[0-9]+:\|( !\[[^]]*\]\([^)]+\) \|)+$' || true)
[ -z "$bad" ] && exit 0
echo "$bad"
exit 1
