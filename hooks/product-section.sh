#!/usr/bin/env bash
# Say when the project's CLAUDE.md lacks its Product or Ship section. SessionStart.
# The global CLAUDE.md is not a project's, so a project whose CLAUDE.md is that file is skipped.
set -u
payload=$(cat)
cwd=$(jq -r '.cwd // "."' <<<"$payload" 2>/dev/null)
root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || echo "$cwd")
f="$root/CLAUDE.md"
global=$(realpath "$HOME/.claude/CLAUDE.md" 2>/dev/null || true)
[ -f "$f" ] && [ "$(realpath "$f")" = "$global" ] && exit 0

missing=""
[ -f "$f" ] || missing="CLAUDE.md"
[ -n "$missing" ] || grep -q '^## Product' "$f" || missing="## Product section in CLAUDE.md"
[ -n "$missing" ] || grep -q '^## Ship' "$f" || missing="## Ship section in CLAUDE.md"
[ -n "$missing" ] || exit 0

jq -n --arg t "This project has no $missing. Load \`vimulatus:product-context\` and write it before you plan or build." \
  '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$t}}'
exit 0
