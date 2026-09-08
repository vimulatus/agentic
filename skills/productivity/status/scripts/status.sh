#!/bin/sh
# Print where a project stands: trunk, what landed lately, open PRs by me, open issues, the map, worktrees.
#   status.sh [days]     days of history to show, default 14
set -u
days=${1:-14}
root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not a git repository"; exit 0; }
cd "$root"
trunk=$(git rev-parse --verify -q main >/dev/null && echo main || echo master)
echo "== $(basename "$root")  branch $(git branch --show-current)  trunk $trunk"
echo "== landed on $trunk, last $days days"
git log --oneline --since="$days days ago" "$trunk" 2>/dev/null | head -20
echo "== local branches not on $trunk"
git branch --no-merged "$trunk" 2>/dev/null | sed 's/^/  /'
echo "== worktrees"
git worktree list | tail -n +2
if git remote get-url origin >/dev/null 2>&1; then
  echo "== open PRs by me"
  gh pr list --author @me --state open --json number,title,isDraft,updatedAt --jq '.[] | "  #\(.number)  \(.title)  \(if .isDraft then "draft" else "" end)  \(.updatedAt[0:10])"' 2>/dev/null
  echo "== map"
  gh issue list --label map --state open --json number,title --jq '.[] | "  #\(.number)  \(.title)"' 2>/dev/null
  echo "== open issues, newest first"
  gh issue list --state open --limit 30 --json number,title,labels,updatedAt --jq '.[] | "  #\(.number)  \(.title)  [\([.labels[].name] | join(","))]  \(.updatedAt[0:10])"' 2>/dev/null
fi
