---
name: issue-queue
description: Work the open GitHub issues to PRs with the dev subagent, and watch for new ones. Use only when Vasu explicitly asks to run the issue queue.
argument-hint: "[--workers <n>] [--map <n>]"
---

# Issue queue

You hold the queue. `dev` holds the code.

Work the queue until it is empty, then idle on the watch. Stop when Vasu says stop, or when you are **blocked**.

## Scope

`--map <n>` scopes the queue to one map: the open tickets that descend from map issue #n. The `wayfinder` skill writes the map.

| Argument | The queue |
|---|---|
| absent | every open issue with no parent |
| `--map <n>` | the open tickets under map #n |

A mapped issue never enters an unscoped queue. The two lanes are disjoint, so an unscoped queue and a `--map` queue run side by side and never race. Two unscoped queues still race each other.

A ticket descends from the map through sub-issues: map -> slice -> ticket. An issue with no parent belongs to no map. An issue a ticket files mid-flight goes under that ticket's slice, so it stays in this queue: "#114 should be part of #57 only, since it deals with pages the issue created." One script reads both lanes, printing `<number>\t<title>`.

```bash
QUEUE_LIST="${CLAUDE_SKILL_DIR}/scripts/queue-list.sh"

"$QUEUE_LIST"              # the parentless issues
"$QUEUE_LIST" --map <n>    # the open tickets under map #n
```

Pass the same flag everywhere. Bare `gh issue list` is never the queue — it returns the mapped issues too. Read each body with `gh issue view <n>`.

```
Worked: maps #1 and #30 are open, in three sessions.

  session A   issue-queue --map 1 --workers 2   -> #13 #14
  session B   issue-queue --map 30              -> #33
  session C   issue-queue                       -> the parentless issues

  #45 lands with no parent      -> session C's watch fires
  #46 lands under slice #32     -> session B's watch fires
```

## 1 — Build the queue

Arm the watch first. An issue filed after this line still reaches you.

```bash
${CLAUDE_SKILL_DIR}/scripts/watch-queue.sh [--map <n>]
```

Run it with the `Monitor` tool, `persistent: true`. One event per issue number you have not seen. A reopened issue counts as new.

Then run `queue-list.sh` once and read every body with `gh issue view <n>`. Each issue lands in one lane.

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

The **frontier** is every Ready issue whose dependencies have all landed. A frontier issue can start now. Step 4 runs it.

## 3 — Pick the base branch

The base is what makes the work stack. You choose it. `dev` runs the command, in its own worktree.

| The issue | Base | Command in the brief |
|---|---|---|
| needs no code from an open PR | trunk | `git switch -c <branch> <trunk>` |
| needs code from an open PR | that PR's branch | `gh stack checkout <PR#>` then `gh stack add <branch>` |

Reach for the stack. A branch cut from trunk that later needs an open PR's code costs a rebase and a second review.

```
Worked: #14 needs the Session model from PR #40.

  gh stack checkout 40
  gh stack add feat/login-route

#14's PR now targets PR #40's branch, so its diff shows the route, not the model.
PR #40 must already exist. Until it does, #14 is not on the frontier.
```

`gh stack init <branch>` starts the first stack in a repo that has none.

## 4 — Run the frontier

`orchestrate` runs it, and `dev` is the worker. With no `--workers`, `orchestrate` sizes the fleet from the machine and moves it as the load moves. `--workers <n>` caps that climb. When a `dev` returns, land its PR (step 5), then recompute the frontier.

Two frontier issues that turn out to touch the same function: hold the second until the first lands. Step 2 should have merged them.

Each brief carries what `orchestrate` asks for, plus:

- the issue number — `dev` reads the body itself with `gh issue view`
- the branch to cut, the base branch its PR targets, and the step 3 command that cuts it
- the instruction to open the PR with `gh pr create --base <base>`
- for a stacked issue: what the PR underneath already changed

## 5 — Land the PR

| The PR | Do |
|---|---|
| stacked | `gh stack sync` — it links the open PRs into one stack on GitHub and pushes the branches |
| from trunk | nothing. It is done |

Run `gh stack sync` again after a PR in the stack merges. It fast-forwards trunk and cascade-rebases what is left.

`gh stack view --short` reads the stack. `gh stack submit --auto` opens PRs without the interactive editor.

## 6 — Babysit the window

Vasu merges the oldest PR first. So the oldest open PR is the only one that can merge next, and a green PR behind it waits either way.

The **window** is the 5 oldest open PRs this queue filed. Run `pr` on those, and only those. This replaces the default: you do not babysit every PR you file.

```bash
gh pr list --state open --author "@me" --json number,createdAt --jq 'sort_by(.createdAt) | .[].number'
```

Oldest first, every PR you authored. Keep the ones this queue filed and take the first five. Another session's PR is not yours to watch, however old it is.

Five is the cap because each window PR holds its own `Monitor` watch, and every watch wakes every 30 seconds. A sixth watch buys noise, not a merge.

A `pr` watch exits on its own when the PR leaves `OPEN`. That event is what slides the window: take the next oldest PR then, and arm `pr` on it. Not before.

```
Worked: the queue has filed 9 PRs. #101 is the oldest.

  watch  #101 #102 #103 #104 #105      the window
  hold   #106 #107 #108 #109           filed, green or red, unwatched

  #101 merges -> its watch exits -> arm pr on #106
```

A stack merges bottom up, so its PRs already sit in the window in merge order.

## A new issue arrives

The watch fires mid-run. Read the body with `gh issue view <n>`, put it in a lane, and act.

| The new issue | Do |
|---|---|
| Skip lane | report the one line. Carry on |
| independent of the run in flight | slot it into the queue by the step 2 rules |
| a run in flight needs its code | `TaskStop` that one run, take the new issue first, then re-run the one you stopped |
| supersedes a run in flight | `TaskStop` that one run, delete its branch, re-triage both |

`TaskStop` the one run the new issue collides with. The other agents keep working.

Never interrupt a `dev` run for an issue that only shares a file. The rebase costs less than the restart.

```
Worked: #52 lands while dev works #47 on feat/login-route.

  #52 asks for the Session model that #47 imports -> stop #47, run #52,
      then cut feat/login-route again on #52's PR branch.
  #52 asks for a new settings page      -> queue it. #47 finishes untouched.
```

## Blocked

Three states are blocked. Report what you tried, take the next independent issue, and come back when Vasu answers.

- a rebase conflict where both sides are real work
- a gate that stays red for a reason the issue did not cause
- an issue that turns out to need a product call

## Report

After each PR, one line: the issue, the PR URL, its base, and whether it entered the window or waits.

When the queue empties, one table: issue, PR, base, state. Then the Skip lane, unchanged. Say the watch is still armed, and stay in the session.

When a `--map` queue empties, the current slice is done. Say so: the next slice waits on `wayfinder`, not on you.

When Vasu says stop, `TaskStop` the watch and report the same table.
