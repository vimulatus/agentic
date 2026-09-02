---
name: babysit-pr
description: Watch a PR you filed until it is ready to merge. Use right after you open a PR, or when asked to babysit one. Not for someone else's PR.
---

# Babysit a PR

```
  arm the watch ──> idle ──> event ──> act ──> push ──┐
                     ▲                                │
                     └────── checks restart ──────────┘
                     │
                  green + approved + 0 threads ──> report ready. Stop.
```

Vasu merges, never you. Stay in the session until you report ready, or you are **blocked**.

## 1 — Arm the watch

Right after `gh pr create`. Run it with the `Monitor` tool, `persistent: true`. One event per state you have not seen, and it exits when the PR leaves `OPEN`.

```bash
pr=<N>; repo=<owner/name>; seen=$(mktemp); : > "$seen"
while true; do
  snap=$(gh pr view "$pr" -R "$repo" --json state,mergeable,reviewDecision,statusCheckRollup --jq '
    "pr \(.state) mergeable=\(.mergeable) review=\(.reviewDecision // "NONE")",
    ([.statusCheckRollup[]? | .conclusion // .state] | "checks \(map(select(.=="SUCCESS" or .=="SKIPPED"))|length) ok \(map(select(.=="FAILURE" or .=="TIMED_OUT" or .=="CANCELLED" or .=="ERROR" or .=="STARTUP_FAILURE"))|length) bad \(map(select(.=="PENDING" or .=="IN_PROGRESS" or .=="QUEUED" or .==null))|length) pending"),
    (.statusCheckRollup[]? | select((.conclusion // .state) as $c | $c=="FAILURE" or $c=="TIMED_OUT" or $c=="ERROR" or $c=="STARTUP_FAILURE")
     | "bad \(.name // .context) \(.detailsUrl // .targetUrl // "")")' 2>/dev/null) || { sleep 30; continue; }
  threads=$(gh api graphql -F owner="${repo%%/*}" -F repo="${repo##*/}" -F pr="$pr" -f query='
    query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){
      reviewThreads(first:100){nodes{id isResolved path comments(first:1){nodes{author{login} body}}}}}}}' \
    --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved|not)
          | "thread \(.id) \(.path) @\(.comments.nodes[0].author.login): \(.comments.nodes[0].body|gsub("\n";" ")|.[0:150])"' 2>/dev/null)
  printf '%s\n%s\n' "$snap" "$threads" | grep -v '^$' | awk '!a[$0]++' | grep -vxF -f "$seen" | tee -a "$seen"
  case "$snap" in "pr OPEN"*) ;; *) echo "watch done"; break;; esac
  sleep 30
done
```

Issue comments miss the watch. Read them on each wake: `gh pr view <N> --json comments --jq '.comments[-3:][].body'`.

## 2 — An event lands

| The event | Do |
|---|---|
| `bad <check>` | step 3 |
| `thread <id>` | step 4 |
| `mergeable=CONFLICTING` | `git fetch origin && git rebase origin/<base> && git push --force-with-lease` |
| `0 bad 0 pending`, `review=APPROVED`, no thread | step 5 |
| `pr CLOSED` | say so. Stop |

One wake is one batch. Push once, because every push restarts the checks.

## 3 — A red check

Read the log first. The check name is not the failure.

```bash
run=$(sed -E 's#.*/runs/([0-9]+).*#\1#' <<< "<detailsUrl>")
gh run view "$run" --log-failed
```

Reproduce it locally and hand the failing command to `red-green`.

- Flaky, and the log shows no assertion: `gh run rerun <run> --failed`. Once. A second flake is a real bug.
- Red on the base branch too: not yours. Say so and carry on.

## 4 — A review thread

Reply to every thread. Resolve only the threads you changed code for.

```bash
gh api graphql -f query='mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(
  input:{pullRequestReviewThreadId:$t, body:$b}){comment{url}}}' -F t=<threadId> -F b="<reply>"

gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -F t=<threadId>
```

The reply is one or two lines: what you did, and the commit sha.

A resolved thread tells the reviewer "handled", so a false one costs them a second read of the whole diff. A suggestion you did not take, and a question, stay open — the reviewer decides. State your reason once and never argue in a thread.

```
Worked: @sam writes "this map is rebuilt on every call".

  took it -> hoist to a module constant, push, reply
             "Hoisted to MIME_BY_EXT at module scope. a1b2c3d." -> resolve
  kept it -> reply "It reads a config that changes per request." -> leave open
```

## Blocked

Stop and report the wall, what you tried, and the one thing that unblocks you.

- a review asks for a product call, or a rewrite you disagree with
- a gate stays red after two honest fixes
- a rebase conflict where both sides are real work
- a check needs a secret or an environment you cannot reach

## 5 — Ready

`TaskStop` the watch. Report the PR URL, every thread with what you did and whether it is open, every check that went red and what fixed it, and the issues the PR closes. Then wait.
