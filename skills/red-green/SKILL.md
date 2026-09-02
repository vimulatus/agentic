---
name: red-green
description: "Build one check that fails, then change the code until it passes. Use before you write code: a bug, a behavior, a refactor, a flake. Not for research, design, or copy."
---

# Red → Green

```
  build the check ──> RED ──> one change ──> run ──> GREEN ──> keep the check
                       ▲                      │
                       │                      │
                  green first?           stalled?
                  the check is wrong     stop and report
```

The check is the skill. The rest is mechanical.

## 1. Build the check

One command. Agent-runnable, unattended. It asserts the exact symptom or the exact requirement, never "did not crash".

| Task | The check |
|---|---|
| Bug | A test that reproduces the reported symptom |
| New behavior | A test written from the requirement, before the code |
| Flake | The same test under stress: repeat 200×, parallel, seeded |
| Slow path | A benchmark with a number in the assertion |
| Type or lint debt | The compiler, with the rule turned on |
| Migration or refactor | A differential: old output vs new output, diffed |
| UI change | `agent-browser`, asserting the visible state |

Make it **tight**: seconds, deterministic, one clear verdict. Pin the clock, seed the RNG, isolate the filesystem. A 30-second flaky check is barely a check.

Spend disproportionate effort here. Be relentless.

### When no command decides it

Stop and ask Vasu. Vasu is the check.

Say what you tried to build and why each attempt failed. Then ask for the one thing that unblocks you:

| The wall | The ask |
|---|---|
| The verdict is taste — naming, copy, architecture | The decision itself |
| You cannot reach the failing environment | Access, or a captured artifact (HAR, log dump, recording) |
| A human must click | Approval to script the step and have them run it |
| The requirement is ambiguous | Which reading is correct |

No check and no answer, no step 2. Changing code on a guess is the failure this skill prevents.

## 2. Watch it go red

A check that is green on its first run measures nothing.

Read the failure. It must be the failure you expect, for the reason you expect. A wrong red gives a wrong green.

If it will not go red, the check is wrong. Fix the check.

Show the invocation and its output before you touch the code.

## 3. Change until green

- **One change per run.** Two changes, and the green tells you nothing.
- **The code moves, the check holds.** Once red, the check is frozen; any edit to it sends you back to step 2.
- **Minimal green.** Enough to pass this check. Nothing speculative.
- **One slice at a time.** One check, one change, then the next check. Writing every check up front verifies imagined behavior.

Refactoring and simplification come after green, not inside the loop.

## Stall

Name the limit before you start: a number of attempts, or a wall you can describe. Reach it and stop.

Report the check, the attempts, the last output, and what you now believe. A stalled loop is evidence. Flailing is not.

## Done

- [ ] The check went red, and you read the red.
- [ ] The check is green.
- [ ] The whole suite is green.
- [ ] The check is committed, and it guards this behavior from now on.
