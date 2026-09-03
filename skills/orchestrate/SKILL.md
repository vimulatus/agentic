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

## The brief

A worker cannot see this conversation. The brief is all it gets. Every brief carries:

- the one task, and where the worker reads the full spec itself
- the branch to cut, and the base it targets
- what a neighbouring worker already changed, when the task sits on top of it
- what to return: the artifact, the check, and anything left open

Name the deliverable. A worker that returns a summary instead of a PR was briefed to.

## Isolation

Pass `isolation: "worktree"` on every `Agent` call that writes code. Two workers in one working tree overwrite each other's files.

Never run two workers on the same function at once. Merge the two tasks into one, or hold the second.

A worktree is a full checkout. Read the free disk with `df -g .` before you spawn the fleet.

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

The **ceiling** is how many workers the machine takes. The number you were given is a cap, not a target.

```
ceiling = min(requested, ncpu / 3)      floor 1
```

A worker is not one core. It forks a test runner that takes several. Past the ceiling the suites queue on the same cores, and every worker gets slower.

```
Worked: this machine, sysctl -n hw.ncpu -> 12

  --workers 8  ->  ceiling 4.  Spawn 4, hold the rest.
  --workers 2  ->  ceiling 2.  The given cap is lower. It wins.
```

Say the number you settled on, and why, in one line.

## The watch

Arm it with the frontier. Run it with the `Monitor` tool, `persistent: true`. It emits one event per crossing, not one per sample.

```bash
ncpu=$(sysctl -n hw.ncpu); state=cool
while true; do
  l1=$(sysctl -n vm.loadavg | awk '{print $2}')
  free=$(memory_pressure -Q | awk '/free percentage/{print $NF+0}')
  now=$(awk -v l="$l1" -v n="$ncpu" -v f="$free" 'BEGIN{
    print (l/n>1.0 || f<15) ? "hot" : (l/n<0.7 && f>25) ? "cool" : "warm"}')
  [ "$now" != "$state" ] && { echo "$now: load $l1 on $ncpu cores, memory free ${free}%"; state=$now; }
  sleep 30
done
```

`cool` and `hot` sit apart on purpose. One threshold flaps, and the fleet spends the run resizing itself.

| Event | The fleet |
|---|---|
| `hot` | do not spawn. Pull the levers below |
| `warm` | hold the fleet where it is |
| `cool` | spawn back up to the ceiling |

## When it runs hot

The levers, cheapest first. Stop at the first one that cools the machine.

| Lever | Costs |
|---|---|
| hold the empty slot | nothing. The next spawn waits |
| serialize the gate | wall clock on one worker |
| stop the youngest worker | that worker's whole run |

There is no pause. `TaskStop` ends a worker and its work is gone, because a subagent does not resume. So the slot you never filled is worth more than the worker you would stop. When you must stop one, stop the **youngest**: it has the least to lose. Put its task back on the frontier and say you did.

Two workers in the gate at once is the usual spike. Serialize the gate instead of stopping either one. Put this in the brief:

```bash
until mkdir /tmp/gate.lock 2>/dev/null; do sleep 5; done
trap 'rmdir /tmp/gate.lock' EXIT
<the gate command>
```

`mkdir` is the lock because macOS ships no `flock`. A worker killed with `-9` leaves the directory behind. `rmdir` it when the frontier stalls with nothing in the gate.

## Report

Per worker, one line: the task, the artifact, its state.

When the fleet drains, one table: task, artifact, state. Then the ceiling you ran at, and every time the watch moved it.
