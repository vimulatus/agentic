#!/bin/sh
# Remove the worktrees whose branch is merged into the trunk, and delete those branches.
#   prune-worktrees.sh [-n] [trunk]     -n lists what would go. trunk defaults to main, or master.
# A dirty worktree is never removed. It is listed with "dirty".
set -eu
dry=""; trunk=""
for a in "$@"; do case "$a" in -n) dry=1 ;; *) trunk=$a ;; esac; done
root=$(git rev-parse --show-toplevel)
[ -n "$trunk" ] || trunk=$(git -C "$root" rev-parse --verify -q main >/dev/null && echo main || echo master)

git -C "$root" worktree list --porcelain | awk '/^worktree /{w=$2} /^branch /{print w, $2}' | while read -r wt ref; do
  [ "$wt" = "$root" ] && continue
  br=${ref#refs/heads/}
  if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then echo "dirty  $wt ($br)"; continue; fi
  if git -C "$root" merge-base --is-ancestor "$br" "$trunk" 2>/dev/null; then
    echo "merged $wt ($br)"
    [ -n "$dry" ] && continue
    git -C "$root" worktree remove "$wt"
    git -C "$root" branch -d "$br" >/dev/null
  else
    echo "open   $wt ($br)"
  fi
done
git -C "$root" worktree prune
