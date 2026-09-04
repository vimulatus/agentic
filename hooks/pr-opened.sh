#!/usr/bin/env bash
# Fires the pr skill after a PR is opened. PostToolUse, gated by `if` on gh pr create and gh stack submit.
set -u
payload=$(cat)

url=$(jq -r '[.tool_response? // {} | .. | strings] | join(" ")' <<<"$payload" 2>/dev/null \
  | grep -oE 'https://[^[:space:]"]+/pull/[0-9]+' | head -1)
[ -n "$url" ] || exit 0

jq -n --arg u "$url" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("You opened \($u). Load the `vimulatus:pr` skill, read its references/watch.md, and arm the watch. A worker told to open it and return skips this: the caller watches.")
  }
}'
