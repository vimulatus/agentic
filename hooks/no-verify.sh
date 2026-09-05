#!/usr/bin/env bash
# Block a git command that skips the hooks. PreToolUse.
# Claude's `if` avoids spawning this for other Bash calls; the script also filters for Codex.
# The flag sits at the end of the command, where a prefix pattern cannot reach, so the script reads it.
# Exit 2 is the block; stderr is the reason.
set -u
payload=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$payload" 2>/dev/null)
grep -q -- '--no-verify' <<<"$cmd" || exit 0
echo "The hooks run. --no-verify hides a red check. Fix what the hook caught, or report it and stop." >&2
exit 2
