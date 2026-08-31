---
name: issue-queue
description: Triage the open GitHub issues and drive them to PRs one at a time with the dev subagent, stacking a PR on the PR it depends on. Use when the user asks to work the backlog, fix several issues in one session, or run an orchestrator session. Not for one named issue, which dev takes alone.
---

# Issue queue

You hold the queue. `dev` holds the code.

Work the queue until it is empty. Stop when you are **blocked**.

## 1 — Build the queue

```
gh issue list --state open --limit 100 --json number,title,labels,body
```

Read every body. Each issue lands in one lane.

| Lane | The issue |
|---|---|
| **Ready** | names the current behaviour, the wanted behaviour, and the surface it touches |
| **Skip** | needs a call only Vasu can make, duplicates another issue, or names no observable change |

Report the Skip lane, one line each with the reason. Then start the Ready lane on your own.

## 2 — Order the queue

An issue depends on another when it needs that issue's code, or edits the same function.

- A dependency runs before its dependants.
- Independent issues run smallest first.
- Two issues that edit the same lines are one issue. Merge them in the queue and say you did.

## 3 — Pick the base branch

You pick the base, not `dev`. The base is what makes the work stack.

| The issue | Base | Command |
|---|---|---|
| needs no code from an open PR | trunk | `git switch -c <branch> <trunk>` |
| needs code from an open PR | that PR's branch | `gh stack checkout <PR#>` then `gh stack add <branch>` |

Reach for the stack. A branch cut from trunk that later needs an open PR's code costs a rebase and a second review.

```
Worked: #14 needs the Session model from PR #40.

  gh stack checkout 40
  gh stack add feat/login-route

#14's PR now targets PR #40's branch, so its diff shows the route, not the model.
```

`gh stack init <branch>` starts the first stack in a repo that has none.

## 4 — Run one issue

Spawn the `dev` subagent, one at a time. It cannot see this conversation, so the brief carries:

- the issue number — it reads the body itself with `gh issue view`
- the branch you checked out, and the base branch its PR targets
- the instruction to open the PR with `gh pr create --base <base>`
- for a stacked issue: what the PR underneath already changed

## 5 — Land the PR

| The PR | Do |
|---|---|
| stacked | `gh stack sync` — it links the open PRs into one stack on GitHub and pushes the branches |
| from trunk | nothing. It is done |

Run `gh stack sync` again after a PR in the stack merges. It fast-forwards trunk and cascade-rebases what is left.

`gh stack view --short` reads the stack. `gh stack submit --auto` opens PRs without the interactive editor.

## Blocked

Three states are blocked. Report what you tried, take the next independent issue, and come back when Vasu answers.

- a rebase conflict where both sides are real work
- a gate that stays red for a reason the issue did not cause
- an issue that turns out to need a product call

## Report

After each PR, one line: the issue, the PR URL, its base.

At the end, one table: issue, PR, base, state. Then the Skip lane, unchanged.
