#!/usr/bin/env bash
# Block a commit or a push that skips the hooks. PreToolUse, Bash. Exit 2 is the block; stderr is the reason.
set -u
payload=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$payload" 2>/dev/null)
grep -qE 'git (commit|push|merge|rebase)\b.*--no-verify' <<<"$cmd" || exit 0
echo "The hooks run. --no-verify hides a red check. Fix what the hook caught, or report it and stop." >&2
exit 2
