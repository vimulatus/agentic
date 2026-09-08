#!/bin/sh
# Remove the worktrees whose branch has landed, and delete those branches.
#   prune-worktrees.sh [-n] [trunk]     -n lists what would go. trunk defaults to main, or master.
# Landed means: an ancestor of the trunk, or the head of a merged PR (a squash or a rebase merge leaves no ancestor).
# A dirty worktree is never removed. It is listed with "dirty".
set -eu
dry=""; trunk=""
for a in "$@"; do case "$a" in -n) dry=1 ;; *) trunk=$a ;; esac; done
root=$(git rev-parse --show-toplevel)
[ -n "$trunk" ] || trunk=$(git -C "$root" rev-parse --verify -q main >/dev/null && echo main || echo master)
gh_ok=""; git -C "$root" remote get-url origin >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && gh_ok=1

landed() {
  git -C "$root" merge-base --is-ancestor "$1" "$trunk" 2>/dev/null && return 0
  [ -n "$gh_ok" ] || return 1
  [ -n "$(cd "$root" && gh pr list --head "$1" --state merged --json number --jq '.[0].number' 2>/dev/null)" ]
}

git -C "$root" worktree list --porcelain | awk '/^worktree /{w=$2} /^branch /{print w, $2}' | while read -r wt ref; do
  [ "$wt" = "$root" ] && continue
  br=${ref#refs/heads/}
  if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then echo "dirty  $wt ($br)"; continue; fi
  if landed "$br"; then
    echo "landed $wt ($br)"
    [ -n "$dry" ] && continue
    git -C "$root" worktree remove "$wt"
    git -C "$root" branch -D "$br" >/dev/null
  else
    echo "open   $wt ($br)"
  fi
done
git -C "$root" worktree prune
