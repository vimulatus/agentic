---
name: orchestrate
description: Run workers in parallel and size the fleet to the machine's load. Use when a run holds more than one independent task. Not for one task, which you do yourself.
---

# Orchestrate

You hold the plan. The **worker** holds the work. A worker is one subagent, one task, one return.

Delegate for breadth and for adversarial review. Do ordinary work yourself, in one pass.

| Reach for a worker | Do it yourself |
|---|---|
| tasks that do not touch each other | one task, however large |
| a read that would flood your context | a change you are already part way through |
| a second opinion on your own diff | anything the worker would have to ask you about |

Before spawning workers or starting watches, read the execution reference for the current client: [Claude Code](references/claude.md) or [Codex](references/codex.md). Read only that reference. It owns context inheritance, isolation, process handles, and interruption.

Resolve `<skill-dir>` below to the absolute directory containing this orchestrate `SKILL.md`; substitute the path before running commands.

## The brief

Make the brief self-contained regardless of how much conversation the runtime shares. Every brief carries:

- the one task, and where the worker reads the full spec itself
- the branch to cut, and the base it targets
- what a neighbouring worker already changed, when the task sits on top of it
- what to return: the artifact, the check, and anything left open

Name the deliverable. A worker that returns a summary instead of a PR was briefed to.

A brief is the task, not the steps. Vasu on a four-change brief with file paths: "I don't want such detailed. Just give me a summary of what we want it to do. I am sure it can figure out these details itself."

## The return

A worker's claim is a claim. Before you relay "done", "green", or a finding as fact, check it: open the PR, run the check, read the diff. One session relayed a worker's issue text and had to take it back: "I relayed that without checking it."

When Vasu asks what a worker is doing, answer per worker: the task, how long it has run, what it has changed. "Still running" is not an answer.

## Isolation

Give each worker that writes code its own worktree using the current client’s execution reference. For instruction-only edits in a shared tree, disjoint file ownership is sufficient.

Never run two workers on the same function at once. Merge the two tasks into one, or hold the second.

A worktree is a full checkout. Read the free disk with `df -g .` before you spawn the fleet.

A worktree dies with its task. When a worker's PR is open, or its branch is merged, remove the worktree and, once merged, its branch. Three projects carry a dozen dead `agent-*` worktrees each, and a `dev` spawned in one reads stale project instructions.

```bash
"<skill-dir>/scripts/prune-worktrees.sh" [-n]    # removes worktrees whose branch is merged; -n lists
```

## The frontier

The **frontier** is every ready task whose blockers have landed. Keep the frontier busy, up to the ceiling. When a worker returns, land its artifact, recompute the frontier, and spawn the next one.

```
Worked: ceiling 3,  tasks  A -> C -> D,  B,  E

  spawn   A  B  E        the frontier, 3 workers
  B returns  -> nothing unblocks, 2 workers run on
  A returns  -> C unblocks -> spawn C
  C returns  -> spawn D
```

Parallel does not change the order. It changes how many frontier tasks run at the same time.

## The ceiling

The **ceiling** is how many workers run at once. It moves. You do not guess it up front — you start small and let the machine tell you.

```
Start at up to 2. Climb on cool, halve on hot, never past the cap.

  cap = min(given, max(1, floor(ncpu / 2)), available worker slots)
  start = min(2, cap)
```

A worker is not one core. It forks a test runner that takes several. Past the cap the suites queue on the same cores, and every worker gets slower.

A number you were given is a cap on the climb, not a target. Without one, use machine capacity and the runtime’s available worker slots. Count this fleet’s running workers plus currently free slots as its available worker slots; workers in other tasks reduce that capacity. With no capacity, do independent work locally or wait for a slot.

```
Worked: sysctl -n hw.ncpu -> 12 and at least 6 worker slots, so cap 6.

  start          2 workers
  cool, cool     3, then 4
  hot            2.  The load crossed 1.0 per core
  cool           3

  --workers 1 -> cap 1. The ceiling cannot climb. This is the old behaviour.
```

Additive up, multiplicative down. You climb slowly enough to find the wall, and you leave it fast enough to matter.

## The watch

Arm it with the frontier using the current client’s watch mechanism. It emits on a crossing, and every fourth sample while the machine is `hot` or `cool`. That repeat is the clock the climb runs on: one ceiling move every two minutes, not one per sample.

```bash
"<skill-dir>/scripts/watch-load.sh"
```

`cool` and `hot` sit apart on purpose. One threshold flaps, and the fleet spends the run resizing itself.

| Event | The ceiling | The fleet |
|---|---|---|
| `cool` | +1, up to the cap | spawn up to it |
| `warm` | hold | hold |
| `hot` | halve it, floor 1 | pull the levers below |

## When it runs hot

The ceiling halves, so the workers already running are above it. Do not stop them yet. Pull the levers, cheapest first, and stop at the first one that cools the machine.

| Lever | Costs |
|---|---|
| hold the empty slot | nothing. The next spawn waits |
| serialize the gate | wall clock on one worker |
| interrupt the youngest worker | inspection and recovery of unfinished work |

Interrupt a worker only when the machine is still `hot` after the gate is serialized, and choose the **youngest**. Inspect its files and process state using the current client’s interruption mechanism, then put its task back on the frontier and say you did. Resume or restart it according to that client’s capabilities.

Two workers in the gate at once is the usual spike. Serialize the gate instead of stopping either one. Put the line in the brief, and the worker runs its gate under the lock:

```bash
"<skill-dir>/scripts/gate-lock.sh" <the gate command>
```

One worker in the gate at a time. The others wait, and none of them loses work.

Stop the load watch and every process this run started when the fleet drains or the run ends.

## Report

Per worker, one line: the task, the artifact, its state.

When the fleet drains, one table: task, artifact, state. Then the ceiling: where it started, every move the watch made, and where it settled.
