---
name: pr
description: Open a pull request and take it to ready. Use when you are about to open a PR, when one you filed gets a comment, a review or a red check, or when asked to babysit one. Not for someone else's PR.
---

# PR

```
  branch ──> commits ──> open ──> arm the watch ──> idle ──> event ──> act ──> push ──┐
                                                     ▲                                │
                                                     └────── checks restart ──────────┘
                                                     │
                                         green + approved + 0 open threads ──> ready. Stop.
```

Vasu merges, never you. Stay in the session until you report ready, or you are **blocked**.

## 1 — The branch and the commits

Keep the history linear. Rebase onto the base branch. Never merge the base branch into your branch.

Land a branch with a rebase or a squash. A merge commit is not an option.

| The commit | The rule |
|---|---|
| Shape | `type(scope): subject` |
| Types | feat, fix, docs, refactor, test, chore |
| Subject | Imperative, lowercase, no full stop |
| Size | One logical change |

```
Worked: you moved a helper and fixed the bug it hid.

  one commit  -> refactor(auth): extract token parsing   <- the move
  two commits -> fix(auth): reject a token with no exp   <- the bug
```

Some repos are local only. Check for a remote before you fetch, push, or open a PR. No remote, no PR.

## 2 — Open it

Rebase onto the latest base branch. `git fetch origin && git rebase origin/<base>`.

```bash
gh pr create --base <base> --title "<title>" --body-file <file>
```

| The part | The rule |
|---|---|
| Title | Simple, plain words |
| Body, first | The problem, in the fewest clear lines |
| Body, then | How you solved it |
| `## Assumptions` | Every assumption you made where Vasu would have answered a question. One line each. No assumptions, no section |
| `Closes #N` | Every issue the PR resolves, not only the one you opened it for |
| Screenshots | A UI change carries them, before and after |

`.agent-evidence/` stays out of git. Upload each shot with `fs` and embed the URL.

### Size the work, never the clock

Vasu sizes work by what it touches, not by how long it takes. Give scope and risk. Never give a duration or an effort, in any form, anywhere — the body, a comment, the ready report.

- **Scope**: the files, the call sites, the steps, and what blocks what.
- **Risk**: what can break, and what is unknown.

```
Wrong: "a small change, about an hour"
Right: "3 files, 1 call site. Risk: the session cookie name is
        read by the mobile client too, and I could not test it."
```

## 3 — Arm the watch

Right after `gh pr create`. Run it with the `Monitor` tool, `persistent: true`. One event per state you have not seen, and it exits when the PR leaves `OPEN`.

```bash
pr=<N>; repo=<owner/name>; seen=$(mktemp); : > "$seen"
while true; do
  snap=$(gh pr view "$pr" -R "$repo" --json state,mergeable,reviewDecision,statusCheckRollup --jq '
    "pr \(.state) mergeable=\(.mergeable) review=\(.reviewDecision // "NONE")",
    ([.statusCheckRollup[]? | .conclusion // .state] | "checks \(map(select(.=="SUCCESS" or .=="SKIPPED"))|length) ok \(map(select(.=="FAILURE" or .=="TIMED_OUT" or .=="CANCELLED" or .=="ERROR" or .=="STARTUP_FAILURE"))|length) bad \(map(select(.=="PENDING" or .=="IN_PROGRESS" or .=="QUEUED" or .==null))|length) pending"),
    (.statusCheckRollup[]? | select((.conclusion // .state) as $c | $c=="FAILURE" or $c=="TIMED_OUT" or $c=="ERROR" or $c=="STARTUP_FAILURE")
     | "bad \(.name // .context) \(.detailsUrl // .targetUrl // "")")' 2>/dev/null) || { sleep 30; continue; }
  comments=$(gh pr view "$pr" -R "$repo" --json comments \
    --jq '.comments[]? | "comment \(.url) @\(.author.login): \(.body|gsub("\n";" ")|.[0:200])"' 2>/dev/null)
  threads=$(gh api graphql -F owner="${repo%%/*}" -F repo="${repo##*/}" -F pr="$pr" -f query='
    query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){
      reviewThreads(first:100){nodes{id isResolved path comments(first:1){nodes{author{login} body}}}}}}}' \
    --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved|not)
          | "thread \(.id) \(.path) @\(.comments.nodes[0].author.login): \(.comments.nodes[0].body|gsub("\n";" ")|.[0:200])"' 2>/dev/null)
  printf '%s\n%s\n%s\n' "$snap" "$comments" "$threads" | grep -v '^$' | awk '!a[$0]++' | grep -vxF -f "$seen" | tee -a "$seen"
  case "$snap" in "pr OPEN"*) ;; *) echo "watch done"; break;; esac
  sleep 30
done
```

The watch reads three sources. A `comment` is a plain comment on the PR, and it carries review just as often as a `thread` does. Read every one.

## 4 — An event lands

| The event | Do |
|---|---|
| `bad <check>` | step 5 |
| `thread <id>` | step 6 |
| `comment <url>` | step 6 |
| `comment <url>` whose body you wrote | nothing. It is your own reply coming back |
| `mergeable=CONFLICTING` | `git fetch origin && git rebase origin/<base> && git push --force-with-lease` |
| `0 bad 0 pending`, `review=APPROVED`, no open thread | step 8 |
| `pr CLOSED` | say so. Stop |

One wake is one batch. Push once, because every push restarts the checks.

Every push you make runs step 7.

## 5 — A red check

Read the log first. The check name is not the failure.

```bash
run=$(sed -E 's#.*/runs/([0-9]+).*#\1#' <<< "<detailsUrl>")
gh run view "$run" --log-failed
```

Reproduce it locally and hand the failing command to `red-green`.

- Flaky, and the log shows no assertion: `gh run rerun <run> --failed`. Once. A second flake is a real bug.
- Red on the base branch too: not yours. Say so and carry on.

## 6 — Feedback

Feedback arrives in three places. Answer all three the same way.

```
review thread   inline on a line   ->  reply on the thread, resolve when you changed code
review body     the summary        ->  reply as a plain comment
plain comment   on the PR itself   ->  reply as a plain comment
```

Reply to every one. Resolve only the threads you changed code for.

```bash
gh api graphql -f query='mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(
  input:{pullRequestReviewThreadId:$t, body:$b}){comment{url}}}' -F t=<threadId> -F b="<reply>"

gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -F t=<threadId>

gh pr comment <N> --body "<reply>"
```

The reply is one or two lines: what you did, and the commit sha.

A resolved thread tells the reviewer "handled", so a false one costs them a second read of the whole diff. A suggestion you did not take, and a question, stay open — the reviewer decides. State your reason once and never argue in a thread.

```
Worked: @sam writes "this map is rebuilt on every call".

  took it -> hoist to a module constant, push, reply
             "Hoisted to MIME_BY_EXT at module scope. a1b2c3d." -> resolve
  kept it -> reply "It reads a config that changes per request." -> leave open
```

A plain comment has no thread to resolve. `gh pr comment` is the whole answer.

## 7 — The evidence goes stale

A screenshot proves the diff that was there when you took it. Every push moves the diff.

After a push that changes what a user sees — a component, a route, a style, a string — retake the shot and swap the URL in the body.

```bash
# browser-evidence writes the new shot, then:
url=$(fs put .agent-evidence/<task>/after.png --bucket evidence --key <task>/after-<sha>.png)
gh pr view <N> --json body --jq .body > body.md
# swap the old URL for $url in body.md, then:
gh pr edit <N> --body-file body.md
```

The key carries the sha, so the old URL keeps working. A reviewer part way through the body does not lose the picture.

```
Worked: @sam asks for a 16px gap. You push a1b2c3d.
        The body still shows the 8px shot, so the reviewer reads a lie.
        Retake -> after-a1b2c3d.png -> edit the body. One extra minute,
        one fewer round trip.
```

Text-only pushes need none of this.

## Blocked

Stop and report the wall, what you tried, and the one thing that unblocks you.

- a review asks for a product call, or a rewrite you disagree with
- a gate stays red after two honest fixes
- a rebase conflict where both sides are real work
- a check needs a secret or an environment you cannot reach

## 8 — Ready

`TaskStop` the watch. Report the PR URL, every thread and comment with what you did and whether it is open, every check that went red and what fixed it, and the issues the PR closes. Then wait.
