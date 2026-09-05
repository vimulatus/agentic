#!/usr/bin/env bash
# Say when the project's runtime instruction file lacks its Product or Ship section. SessionStart.
# The global instruction file is not a project's, so a project symlinked to it is skipped.
set -u
payload=$(cat)
cwd=$(jq -r '.cwd // "."' <<<"$payload" 2>/dev/null)
root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || echo "$cwd")
if [ -n "${PLUGIN_ROOT:-}" ]; then
  name=AGENTS.md
  global=$(realpath "$HOME/.codex/AGENTS.md" 2>/dev/null || true)
else
  name=CLAUDE.md
  global=$(realpath "$HOME/.claude/CLAUDE.md" 2>/dev/null || true)
fi
f="$root/$name"
[ -f "$f" ] && [ "$(realpath "$f")" = "$global" ] && exit 0

missing=""
[ -f "$f" ] || missing="$name"
[ -n "$missing" ] || grep -q '^## Product' "$f" || missing="## Product section in $name"
[ -n "$missing" ] || grep -q '^## Ship' "$f" || missing="## Ship section in $name"
[ -n "$missing" ] || exit 0

jq -n --arg t "This project has no $missing. Load \`vimulatus:product-context\` and write it before you plan or build." \
  '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$t}}'
exit 0
