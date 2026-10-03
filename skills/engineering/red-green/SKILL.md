---
name: red-green
description: "Establish a behavior check before changing code and keep it passing afterward. Use for a bug, new behavior, refactor, or flake. Not for research, design, or copy."
---

# Red → Green

Choose a check that distinguishes the required behavior from the failure. For bugs and new behavior, demonstrate the expected failure before implementation. For behavior-preserving refactors, establish a passing baseline and preserve it.

## The check

Use an unattended, agent-runnable command that asserts the symptom or requirement.

| Task | The check |
|---|---|
| Bug | A test that reproduces the reported symptom |
| New behavior | A test written from the requirement, before the code |
| Flake | The same test under conditions that reproduce the flake, with recorded seeds and repetition counts |
| Slow path | A benchmark with a performance requirement in the assertion |
| Type or lint debt | The compiler, with the rule turned on |
| Behavior-preserving migration or refactor | A characterization baseline or old/new output comparison |
| UI change | `browser-evidence`, asserting the visible state |

Keep the check focused and reproducible. Control the clock, randomness and filesystem where they affect the result.

**A test must be able to fail.** Call the code the way its users do, and assert the result against a literal value. Before you keep a test, ask: would it still pass if every function it imports returned `undefined`? If yes, it cannot catch a defect. Rewrite the assertion, or delete the test. The usual shapes: an assertion that only checks that a value exists or is truthy, a mock that was called, an expected value computed by the code under test, a restated constant, and an empty result checked alone.

```
expect(slugify).toBeDefined()                          passes on undefined -> rewrite
expect(slugify("Hello, World!")).toBe("hello-world")   fails on undefined  -> keep
```

When no command decides the outcome, use the available evidence and state what remains untested. Settle reversible implementation choices yourself. Ask Vasu when progress requires an unresolved product decision, unavailable access or an action only he can perform; explain the missing input and continue independent work.

## Establish the baseline

For changed behavior, inspect the failure and confirm it has the expected cause. If the check passes unexpectedly, investigate whether it exercises the requirement or whether the behavior already exists. Do not manufacture a failure.

For behavior-preserving changes, record the passing baseline. A differential check must exercise the same inputs against both implementations.

Retain the command and result so the change can be compared with its baseline.

**Fix the cause, not the symptom.** Reproduce the failure first. Then ask why until the answer is a cause you can change. Do not add a guard that hides the failure: a null check that stops a crash leaves the bad value in place. When you cannot see the cause, add logging or read the actual error; do not guess. A failure that starts after a restart usually comes from stale state: a config file, a cache, a lock file.

```
The page crashes on user.name.
  guard user?.name          -> the crash stops; the page shows a blank name
  why is user null?         -> the session cache holds a deleted user
  fix: clear the cache entry when the user is deleted
```

## Make the change

**One change, then its check.** Make one change, run the check, and continue only when it is green. A failure found after five changes can come from any of the five. Order the commits so that they prove the work: the failing test first, then the fix on top of it. A removal before the reshape, and a baseline before the change, prove the same way.

Preserve the requirement asserted by the check; if that check needs correction, establish its baseline again. Implement the behavior without speculative additions, then simplify while keeping the checks green.

**Two failed fixes on one assumption: test the assumption.** When two fixes that share an assumption fail the same check, a third fix on that assumption will fail too. Write the assumption in one sentence. Measure it before the next fix: count where the failure happens, per worker, per input or per caller. A skewed count names what to change. An even count means the assumption is not the cause; keep the count and look elsewhere.

```
Assumption: the export job times out because the service is slow.
  fix 1: timeout 30 s -> 60 s     fails
  fix 2: retry 3 times            fails
  count of jobs per worker: worker 1 gets 80% of the jobs
  change: how jobs are assigned, not the timeout
```

When an approach stalls for another reason, use the failed attempts to choose the next approach. Report the evidence and ask for input when further progress depends on a decision or resource you do not have. Respect any explicit task budget.

## Done

**Check the thing, not a sign of it.** Observe the result directly: read the written rows, run the command, open the page. A log line that says "saved", a build that exits 0, a file timestamp and a worker's own report are signs. When a check fails, suspect how you observed it before you suspect the system.

- The check demonstrates the required behavior against the appropriate baseline.
- The relevant checks and the project's required gate pass.
- The regression or characterization check is retained with the change.
- The report identifies the evidence and anything untested.
- The final message has one line for each rule above that changed a decision: `<rule>: <what it changed>`, where `<rule>` is the bold name. A rule that changed nothing is not listed.
