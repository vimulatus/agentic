#!/bin/sh
# Close a ticket's parent issue when its last sub-issue is done.
#   close-parent.sh <ticket>       prints "closed #P", "open #P: N of M done", or "no parent"
set -eu
t=${1:?usage: close-parent.sh <ticket>}
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
p=$(gh api graphql -F o="${repo%%/*}" -F r="${repo##*/}" -F n="$t" -f query='
  query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){ issue(number:$n){ parent{ number } } } }' \
  --jq '.data.repository.issue.parent.number // empty')
[ -n "$p" ] || { echo "no parent"; exit 0; }
s=$(gh api "repos/$repo/issues/$p" --jq '.sub_issues_summary | "\(.completed) \(.total) \(.completed == .total)"')
set -- $s
if [ "$3" = true ]; then
  gh issue close "$p" -R "$repo" >/dev/null && echo "closed #$p"
else
  echo "open #$p: $1 of $2 done"
fi
