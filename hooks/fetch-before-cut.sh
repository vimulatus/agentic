#!/usr/bin/env bash
# Fetch origin before a branch or a worktree is cut, so the cut lands on the base as it is now. PreToolUse, Bash.
# Eleven sessions cut from a local copy of main and were told "rebase on top of new origin/main".
set -u
payload=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$payload" 2>/dev/null)
cwd=$(jq -r '.cwd // "."' <<<"$payload" 2>/dev/null)
grep -qE 'git (switch -c|switch --create|checkout -b|worktree add|branch [^-])' <<<"$cmd" || exit 0
git -C "$cwd" remote get-url origin >/dev/null 2>&1 || exit 0
t=$(command -v timeout || command -v gtimeout || true)
${t:+$t 20} git -C "$cwd" fetch -q origin 2>/dev/null || true
exit 0
