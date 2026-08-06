#!/bin/bash

# WorktreeCreate hook for Claude Code
# It does three things:
#   1. Create the worktree with branch name `<name>` instead of `worktree-<name>`
#   2. Copies files matching `.worktreeinclude` patterns, and
#
# Input (JSON on stdin): { "name": "<slug>", "cwd": "<project-root>", ... }
# Output (stdout):  Absolute path to the created worktree directory
# All informational output goes to stderr to keep stdout clean for the path.

set -e

INPUT=$(cat)

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required for worktree hooks. Install it: https://jqlang.github.io/jq/download/" >&2
  echo " Windows (winget): winget install jqlang.jq" >&2
  echo " Windows (scoop): scoop install jq" >&2
  exit 1
fi

NAME=$(echo "$INPUT" | jq -r '.name')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Claude Code sends Windows paths in JSON on Windows,
# but bash/find needs Unix-style paths
# cygpath is available in Git Bash on Windows.
to_unix_path() {
  if command -v cygpath &>/dev/null; then
    cygpath -u "$1"
  else
    echo "$1"
  fi
}

to_native_path() {
  if command -v cygpath &>/dev/null; then
    cygpath -w "$1"
  else
    echo "$1"
  fi
}

if [[ -n "$CWD" && "$CWD" != "null" ]]; then
  GIT_ROOT=$(to_unix_path "$CWD")
else
  GIT_ROOT=$(git rev-parse --show-toplevel)
fi

WORKTREE_DIR="$GIT_ROOT/.claude/worktrees"
WORKTREE_PATH="$WORKTREE_DIR/$NAME"
BRANCH_NAME="$NAME"

if ! grep -qF '.claude/worktrees' "$GIT_ROOT/.gitignore" 2>/dev/null; then
  # Add a newline if file doesn't end with one
  if [[ -f "$GIT_ROOT/.gitignore" ]] && [[ -n "$(tail -c 1 "$GIT_ROOT/.gitignore")" ]]; then
    echo "" >> "$GIT_ROOT/.gitignore"
  fi
  echo ".claude/worktrees" >> "$GIT_ROOT/.gitignore"
  echo "Added .claude/worktrees to .gitignore" >&2
fi

# Use the default remote branch
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@') || true
if [[ -z "$DEFAULT_BRANCH" ]]; then
  for candidate in main dev master; do
    if git show-ref --verify --quiet "refs/remotes/origin/$candidate" 2>/dev/null; then
      DEFAULT_BRANCH="$candidate"
      break
    fi
  done
fi
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

# Prefer the remote-tracking ref; fall back to the local branch when there is no
# remote (or it was never fetched), then to HEAD.
if git show-ref --verify --quiet "refs/remotes/origin/$DEFAULT_BRANCH" 2>/dev/null; then
  BASE_REF="origin/$DEFAULT_BRANCH"
elif git show-ref --verify --quiet "refs/heads/$DEFAULT_BRANCH" 2>/dev/null; then
  BASE_REF="$DEFAULT_BRANCH"
else
  BASE_REF="HEAD"
fi

mkdir -p "$WORKTREE_DIR"

if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
  echo "Using existing branch: $BRANCH_NAME" >&2
  git worktree add "$WORKTREE_PATH" "$BRANCH_NAME" >&2
else
  echo "Creating branch: $BRANCH_NAME (from $BASE_REF)" >&2
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_REF" >&2
fi

# --- Copy .worktreeinclude files ---
# .worktreeinclude uses gitignore syntax (globs, negation, directory patterns).
# We pass it directly to use git's pattern matching engine via --exclude-from,
# so all gitignore rules work natively: *, **, !, trailing /, etc.
INCLUDE_FILE="$GIT_ROOT/.worktreeinclude"

if [[ -f "$INCLUDE_FILE" ]]; then
  file_list=$(git -C "$GIT_ROOT" ls-files --others --ignored --exclude-from="$INCLUDE_FILE" 2>/dev/null)

  if [[ -z "$file_list" ]]; then
    echo "No files matched .worktreeinclude patterns" >&2
  else
    count=$(echo "$file_list" | wc -l | tr -d ' ')
    echo "Copying $count file(s) from .worktreeinclude..." >&2

    git -C "$GIT_ROOT" ls-files -z --others --ignored --exclude-from="$INCLUDE_FILE" 2>/dev/null | \
      tar -C "$GIT_ROOT" --null -T - -cf - 2>/dev/null | \
      tar -C "$WORKTREE_PATH" -xf - 2>/dev/null

    echo "$file_list" | awk -F/ '{print ($2 ? $1"/" : $0)}' | sort | uniq -c | \
      while read -r cnt path; do
        if [[ "$cnt" -eq 1 && "$path" != */ ]]; then
          echo " + $path" >&2
        else
          echo " + $path ($cnt files)" >&2
        fi
      done
  fi
else
  echo "No .worktreeinclude file found - skipping file copy" >&2
fi

ABSOLUTE_PATH=$(cd "$WORKTREE_PATH" && pwd)
echo "$(to_native_path "$ABSOLUTE_PATH")"
