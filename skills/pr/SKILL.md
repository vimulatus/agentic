---
name: pr
description: Open a pull request and take it to ready. Use when you cut a branch, open a PR, or one you filed gets feedback or a red check. Not for someone else's PR.
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

Keep the history linear. Rebase onto the base branch, and land the branch with a rebase or a squash.

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

Check for a remote before you fetch, push, or open a PR. Some repos are local only, and those have no PR.

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

### Size

Size the work by what it touches. Every size you write — the body, a comment, the ready report — is scope and risk.

- **Scope**: the files, the call sites, the steps, and what blocks what.
- **Risk**: what can break, and what is unknown.

```
Clock: "a small change, about an hour"
Size:  "3 files, 1 call site. Risk: the session cookie name is
        read by the mobile client too, and I could not test it."
```

## 3 — Arm the watch

Right after `gh pr create`. Run it with the `Monitor` tool, `persistent: true`.

```bash
${CLAUDE_PLUGIN_ROOT}/skills/pr/scripts/watch-pr.sh <N> [owner/name]
```

One event per state you have not seen. It exits when the PR leaves `OPEN`.

A plain `comment` carries review as often as a `thread` does. Read every one.

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

One wake is one batch. Push once, because every push restarts the checks, and every push runs step 7.

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

Reply to every one. Resolve only the threads you changed code for.

```
review thread   inline on a line   ->  reply on the thread, then resolve
review body     the summary        ->  reply as a plain comment
plain comment   on the PR itself   ->  reply as a plain comment
```

```bash
${CLAUDE_PLUGIN_ROOT}/skills/pr/scripts/thread.sh reply <threadId> "<reply>"
${CLAUDE_PLUGIN_ROOT}/skills/pr/scripts/thread.sh resolve <threadId>

gh pr comment <N> --body "<reply>"    # a review body, or a plain comment
```

The reply is one or two lines: what you did, and the commit sha.

A resolved thread tells the reviewer "handled", so a false one costs them a second read of the whole diff. A suggestion you did not take, and a question, stay open — the reviewer decides. State your reason once.

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
${CLAUDE_PLUGIN_ROOT}/skills/pr/scripts/refresh-shot.sh <N> <task> .agent-evidence/<task>/after.png
```

It uploads under the current sha and swaps the URL. The old URL keeps working, so a reviewer part way through the body keeps the picture.

```
Worked: @sam asks for a 16px gap. You push a1b2c3d.
        The body still shows the 8px shot, so the reviewer reads a lie.
        Retake -> after-a1b2c3d.png -> edit the body.
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
