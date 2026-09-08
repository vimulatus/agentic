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

When no command decides the outcome, use the available evidence and state what remains untested. Settle reversible implementation choices yourself. Ask Vasu when progress requires an unresolved product decision, unavailable access or an action only he can perform; explain the missing input and continue independent work.

## Establish the baseline

For changed behavior, inspect the failure and confirm it has the expected cause. If the check passes unexpectedly, investigate whether it exercises the requirement or whether the behavior already exists. Do not manufacture a failure.

For behavior-preserving changes, record the passing baseline. A differential check must exercise the same inputs against both implementations.

Retain the command and result so the change can be compared with its baseline.

## Make the change

Keep changes small enough to attribute failures. Preserve the requirement asserted by the check; if that check needs correction, establish its baseline again. Implement the behavior without speculative additions, then simplify while keeping the checks green.

When an approach stalls, use the failed attempts to choose the next approach. Report the evidence and ask for input when further progress depends on a decision or resource you do not have. Respect any explicit task budget.

## Done

- The check demonstrates the required behavior against the appropriate baseline.
- The relevant checks and the project's required gate pass.
- The regression or characterization check is retained with the change.
- The report identifies the evidence and anything untested.
