#!/usr/bin/env bash
# Fires the pr skill after `gh pr create` opens a PR.
set -u
payload=$(cat)

cmd=$(jq -r '.tool_input.command // ""' <<<"$payload" 2>/dev/null) || exit 0
case "$cmd" in *"gh pr create"*) ;; *) exit 0 ;; esac

url=$(jq -r '[.tool_response? // {} | .. | strings] | join(" ")' <<<"$payload" 2>/dev/null \
  | grep -oE 'https://[^[:space:]"]+/pull/[0-9]+' | head -1)
[ -n "$url" ] || exit 0

jq -n --arg u "$url" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("You opened \($u). Load the `vimulatus:pr` skill and start at step 3.")
  }
}'
