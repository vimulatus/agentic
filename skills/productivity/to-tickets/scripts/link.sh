#!/bin/sh
# Draw one edge between issues. Both take issue numbers, not node ids.
#   link.sh sub   <parent> <child>      make <child> a sub-issue of <parent>
#   link.sh block <ticket> <blocker>    <ticket> is blocked by <blocker>
set -eu
case "${1:-}" in
  sub|block) : ;;
  *) echo "usage: link.sh sub <parent> <child> | link.sh block <ticket> <blocker>" >&2; exit 2 ;;
esac
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)

case "$1" in
  sub)
    id=$(gh api "repos/$repo/issues/${3:?child}" --jq .id)
    gh api "repos/$repo/issues/${2:?parent}/sub_issues" -F sub_issue_id="$id" --jq .number ;;
  block)
    id=$(gh api "repos/$repo/issues/${3:?blocker}" --jq .id)
    gh api "repos/$repo/issues/${2:?ticket}/dependencies/blocked_by" -F issue_id="$id" --jq .number ;;
esac
