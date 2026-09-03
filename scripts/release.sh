#!/bin/sh
# Cut a plugin release: bump the version, commit, tag, push the branch and the tag.
#   release.sh [major|minor|patch] [-n]     default: minor.  -n prints the plan and stops.
# The marketplace tracks this branch, so the push is what ships. autoUpdate picks it up on the next session.
set -eu
part=minor; dry=""
for a in "$@"; do case "$a" in major|minor|patch) part=$a ;; -n) dry=1 ;; *) echo "usage: release.sh [major|minor|patch] [-n]" >&2; exit 2 ;; esac; done

root=$(git rev-parse --show-toplevel)
manifest="$root/.claude-plugin/plugin.json"
cur=$(jq -r .version "$manifest")
IFS=. read -r M m p <<EOV
$cur
EOV
case $part in major) M=$((M+1)); m=0; p=0 ;; minor) m=$((m+1)); p=0 ;; patch) p=$((p+1)) ;; esac
next="$M.$m.$p"
branch=$(git -C "$root" branch --show-current)

echo "$cur -> $next on $branch"
[ -z "$dry" ] || exit 0
[ -z "$(git -C "$root" status --porcelain)" ] || { echo "commit or stash first: the tree is dirty" >&2; exit 1; }

jq --arg v "$next" '.version = $v' "$manifest" > "$manifest.tmp" && mv "$manifest.tmp" "$manifest"
git -C "$root" add "$manifest"
git -C "$root" commit -q -m "chore(plugin): bump version to $next"
git -C "$root" tag -a "v$next" -m "v$next"
git -C "$root" push -q origin "$branch" "v$next"
echo "released v$next"
