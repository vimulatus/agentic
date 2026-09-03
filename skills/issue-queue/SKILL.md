---
name: issue-queue
description: Work the open GitHub issues to PRs with the dev subagent, and watch for new ones.
argument-hint: "[--workers <n>] [--map <n>]"
disable-model-invocation: true
---

# Issue queue

You hold the queue. `dev` holds the code.

Work the queue until it is empty, then idle on the watch. Stop when Vasu says stop, or when you are **blocked**.

## Workers

`dev` is the worker. `--workers <n>` is how many run at once. No argument means 1. A value below 1, or one that is not a number, is an error: say so and use 1.

`orchestrate` owns the fleet — the ceiling, the watch, the levers when the machine runs hot. Load it before step 4.

## Scope

`--map <n>` scopes the queue to one map: the open tickets that descend from map issue #n. The `wayfinder` skill writes the map.

| Argument | The queue |
|---|---|
| absent | every open issue |
| `--map <n>` | the open tickets under map #n |

A ticket descends from the map through sub-issues: map -> slice -> ticket. This function lists them.

```bash
map_tickets() {
  gh api graphql -F o='{owner}' -F r='{repo}' -F n="$1" -f query='
    query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){ issue(number:$n){
      subIssues(first:50){ nodes{ subIssues(first:50){ nodes{ number state title } } } } } } }' \
    --jq '.data.repository.issue.subIssues.nodes[].subIssues.nodes[]
          | select(.state=="OPEN") | "\(.number)\t\(.title)"'
}
```

With `--map`, every `gh issue list` in step 1 becomes `map_tickets <n>`: the `seen` file, the poll, and the listing. Read each ticket's body with `gh issue view <n>`. An issue outside the map never enters the queue, and the watch never fires for it.

Two queues run at once only when each holds its own `--map`. Two unscoped queues race for the same issues.

```
Worked: maps #1 and #30 are open, in two sessions.

  session A   issue-queue --map 1 --workers 2   -> #13 #14
  session B   issue-queue --map 30              -> #33

  #45 lands with no parent      -> neither watch fires. Vasu runs it by hand
  #46 lands under slice #32     -> session B's watch fires
```

## 1 — Build the queue

Arm the watch first. An issue filed after this line still reaches you.

```bash
seen=$(mktemp)
gh issue list --state open --limit 100 --json number --jq '.[].number' > "$seen"
while true; do
  sleep 60
  open=$(gh issue list --state open --limit 100 --json number,title \
    --jq '.[] | "\(.number)\t\(.title)"' 2>/dev/null) || continue
  printf '%s\n' "$open" | while IFS=$'\t' read -r n t; do
    [ -n "$n" ] && ! grep -qx "$n" "$seen" && { echo "new issue #$n: $t"; echo "$n" >> "$seen"; }
  done
done
```

Run it with the `Monitor` tool, `persistent: true`. One event per issue number you have not seen. A reopened issue counts as new.

Then list what is open now.

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

`orchestrate` runs it: the ceiling, the dispatch loop, the worktree, the watch. When a `dev` returns, land its PR (step 5), then recompute the frontier.

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

After each PR, one line: the issue, the PR URL, its base.

When the queue empties, one table: issue, PR, base, state. Then the Skip lane, unchanged. Say the watch is still armed, and stay in the session.

When a `--map` queue empties, the current slice is done. Say so: the next slice waits on `wayfinder`, not on you.

When Vasu says stop, `TaskStop` the watch and report the same table.
