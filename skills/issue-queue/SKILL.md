---
name: issue-queue
description: Triage the open GitHub issues, then drive them to PRs one at a time with the dev subagent, stacking a PR on the PR it depends on. Use when the user asks to work through the backlog, fix multiple issues, clear the open issues, or start a long orchestrator session. Not for one named issue, which dev takes alone.
---

# Issue queue

You hold the queue. `dev` holds the code. One issue at a time, from the backlog to a PR.

You are long-running. Work the queue until it is empty. Stop only when you are blocked.

## 1 — Build the queue

```
gh issue list --state open --limit 100 --json number,title,labels,body
```

Read every body. Put each issue in one lane.

| Lane | The issue |
|---|---|
| **Ready** | names the current behaviour, the wanted behaviour, and the surface it touches |
| **Skip** | needs a call only Vasu can make, or duplicates another issue, or names no observable change |

Report the Skip lane, one line each, and say why. Then start the Ready lane. Do not wait for a go-ahead.

## 2 — Order the queue

Draw the dependency graph before you touch any code. An issue depends on another when it needs that issue's code, or edits the same function.

```
#12 add the Session model
     |
     +--> #14 the login route      (imports Session)
     |
     +--> #18 the logout route     (imports Session)

#31 fix the date format in the footer   (independent)
```

Order: a dependency before its dependants. Independent issues in any order, smallest first.

Two issues that edit the same lines are one issue. Merge them in the queue and tell Vasu you did.

## 3 — Pick the base branch

You pick the base, not `dev`. The base decides whether the work stacks.

| The issue | Base | Command |
|---|---|---|
| needs no code from an open PR | trunk | `git switch -c <branch> <trunk>` |
| needs code from an open PR | that PR's branch | `gh stack checkout <PR#>` then `gh stack add <branch>` |

Reach for the stack. A branch cut from trunk that later needs an open PR's code costs a rebase and a second review. `gh stack init <branch>` starts the first stack in a repo that has none.

Worked: #14 needs the `Session` model from PR #40 (issue #12).

```
gh stack checkout 40
gh stack add feat/login-route
```

`feat/login-route` now sits on PR #40's branch, and the PR you open targets it.

## 4 — Run one issue

Spawn the `dev` subagent. It cannot see this conversation, so the brief carries:

- the issue number — it reads the body itself with `gh issue view`
- the branch you checked out, and the base branch its PR targets
- for a stacked issue: what the PR underneath already changed, so it does not rebuild it
- the instruction to open the PR with `gh pr create --base <base>`

Wait for it. Never run two.

## 5 — Land the PR

`dev` returns the PR URL. Then:

- **stacked** — `gh stack sync`. It links the open PRs into one stack on GitHub and pushes the branches.
- **from trunk** — nothing. The PR is done.

When a PR in the stack merges, run `gh stack sync` again before the next issue. It fast-forwards trunk and cascade-rebases what is left.

`gh stack view --short` reads the current stack. `gh stack submit --auto --open` opens PRs for every branch that has none, without the interactive editor.

## When you are blocked

Stop and report. Do not guess your way past:

- a rebase conflict where both sides are real work
- a gate that stays red for a reason the issue did not cause
- an issue that turns out to need a product call

Say what you tried, then take the next independent issue in the queue. Come back when Vasu answers.

## Report

After each PR, one line: the issue, the PR URL, and its base.

At the end, one table: issue, PR, base, state. Then the Skip lane, unchanged.
