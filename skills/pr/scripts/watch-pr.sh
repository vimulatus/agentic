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
    "pr \(.state) mergeable=\(.mergeable) review=\(.reviewDecision // "NONE")",
    ([.statusCheckRollup[]? | .conclusion // .state] | "checks \(map(select(.=="SUCCESS" or .=="SKIPPED"))|length) ok \(map(select(.=="FAILURE" or .=="TIMED_OUT" or .=="CANCELLED" or .=="ERROR" or .=="STARTUP_FAILURE"))|length) bad \(map(select(.=="PENDING" or .=="IN_PROGRESS" or .=="QUEUED" or .==null))|length) pending"),
    (.statusCheckRollup[]? | select((.conclusion // .state) as $c | $c=="FAILURE" or $c=="TIMED_OUT" or $c=="ERROR" or $c=="STARTUP_FAILURE")
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
