#!/bin/sh
# Emit one line per PR state you have not seen. Exits when the PR leaves OPEN.
# For the Monitor tool, persistent: true.
#   watch-pr.sh <number> [owner/name]
# Events: "pr <state> ...", "base <sha>" when the base branch moves, "checks N ok N bad N pending",
#         "bad <check> <url>", "comment <url> @who: ...", "thread <id> <path> @who: ...", "watch done"
set -u
pr=${1:?usage: watch-pr.sh <number> [owner/name]}
repo=${2:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}
seen=$(mktemp); : > "$seen"
base=$(gh pr view "$pr" -R "$repo" --json baseRefName --jq .baseRefName 2>/dev/null)
# the base sha at arm time is already seen: the first event is a move, not the starting point
gh api "repos/$repo/commits/$base" --jq '"base \(.sha)"' >> "$seen" 2>/dev/null

while true; do
  snap=$(gh pr view "$pr" -R "$repo" --json state,mergeable,reviewDecision,statusCheckRollup --jq '
    def bucket:
      if .status != null and .status != "COMPLETED" then "pending"
      else (.conclusion // .state) as $result
        | if (["SUCCESS", "NEUTRAL", "SKIPPED"] | index($result)) != null then "ok"
          elif (["FAILURE", "TIMED_OUT", "CANCELLED", "ERROR", "STARTUP_FAILURE", "ACTION_REQUIRED", "STALE"] | index($result)) != null then "bad"
          else "pending" end
      end;
    [.statusCheckRollup[]? | . + {bucket: bucket}] as $checks |
    "pr \(.state) mergeable=\(.mergeable) review=\(.reviewDecision // "NONE")",
    ($checks | "checks \(map(select(.bucket=="ok"))|length) ok \(map(select(.bucket=="bad"))|length) bad \(map(select(.bucket=="pending"))|length) pending"),
    ($checks[] | select(.bucket=="bad")
     | "bad \(.name // .context) \(.detailsUrl // .targetUrl // "")")' 2>/dev/null) || { sleep 30; continue; }

  basesha=$(gh api "repos/$repo/commits/$base" --jq '"base \(.sha)"' 2>/dev/null)

  comments=$(gh pr view "$pr" -R "$repo" --json comments \
    --jq '.comments[]? | "comment \(.url) @\(.author.login): \(.body|gsub("\n";" ")|.[0:200])"' 2>/dev/null)

  threads=$(gh api graphql -F owner="${repo%%/*}" -F repo="${repo##*/}" -F pr="$pr" -f query='
    query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){
      reviewThreads(first:100){nodes{id isResolved path comments(first:1){nodes{author{login} body}}}}}}}' \
    --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved|not)
          | "thread \(.id) \(.path) @\(.comments.nodes[0].author.login): \(.comments.nodes[0].body|gsub("\n";" ")|.[0:200])"' 2>/dev/null)

  printf '%s\n%s\n%s\n%s\n' "$snap" "$basesha" "$comments" "$threads" \
    | grep -v '^$' | awk '!a[$0]++' | grep -vxF -f "$seen" | tee -a "$seen"

  case "$snap" in "pr OPEN"*) ;; *) echo "watch done"; break ;; esac
  sleep 30
done
