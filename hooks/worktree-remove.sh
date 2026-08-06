#!/bin/bash

# WorktreeRemove hook for Claude Code
# It cleans up the worktree when a worktree session ends.
#
# Input (JSON on stdin): { "worktree_path": "<absolute-path>", ... }

set -e

INPUT=$(cat)

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required for worktree hooks. Install it: https://jqlang.github.io/jq/download/" >&2
  echo " Windows (winget): winget install jqlang.jq" >&2
  echo " Windows (scoop): scoop install jq" >&2
  exit 1
fi

WORKTREE_PATH=$(echo "$INPUT" | jq -r '.worktree_path')

if [[ -z "$WORKTREE_PATH" || "$WORKTREE_PATH" == "null" ]]; then
  echo "No worktree_path provided" >&2
  exit 0
fi

if command -v cygpath &>/dev/null; then
  WORKTREE_PATH=$(cygpath -u "$WORKTREE_PATH")
fi

if [[ ! -d "$WORKTREE_PATH" ]]; then
  # Already remoted, nothing to do
  exit 0
fi

if git worktree remove "$WORKTREE_PATH" --force 2>/dev/null; then
  echo "Removed worktree: $WORKTREE_PATH" >&2
else
  echo "git worktree remove failed, attempting manual cleanup..." >&2
  git worktree prune 2>/dev/null || true
  rm -rf "$WORKTREE_PATH" 2>/dev/null || true
fi

exit 0
