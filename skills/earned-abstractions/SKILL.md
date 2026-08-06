---
name: earned-abstractions
description: Every abstraction must be earned — decision tests for when a helper, option, interface, variant, or layer is justified. Use whenever writing, refactoring, or reviewing code.
---

# Earned abstractions

An abstraction is anything that exists to serve code other than the line in front of you: a helper, interface, class, option, parameter, prop, variant union, layer, config knob. Each one must be **earned** by something present in the task — never by an imagined future. Not earned → write the plain version.

## The ledger — what earns what

| Abstraction | Earned by | Not earned by |
|---|---|---|
| Shared helper (DRY) | the third occurrence | the second — twice is coincidence |
| Named shared type / interface | the second declaration of the same concept — if one changes, the other must | shapes that merely coincide |
| Option / parameter / prop | a caller in this change that passes a different value | a caller you can imagine |
| Variant union / enum | the second variant | one variant "for extensibility" — a boolean is fine, unless the flag reconfigures the component into a different one: that's two components, split them |
| Interface / port / DI seam | a second implementation, or a test that exists and needs the seam | "testability" no current test uses |
| Custom error type | a caller that branches on it | politeness |
| Config knob | two deployments or callers needing different values | tunability |
| Context / compound components / render props | prop explosion or drilling pain already present | a component that might grow |
| New layer / module split | the two sides having already changed independently | symmetry with the rest of the codebase |

An earned abstraction is taken without apology, and the earning event is usually your own change: when the feature in front of you is the second variant or the third occurrence, promoting the existing inline version to the shared form belongs in this diff — leaving a fourth copy of a thrice-duplicated block is as much a failure as a speculative framework.

Counting governs coincidental similarity; identity doesn't wait.

The ledger settles in your reasoning and the PR description; the word never appears in code or comments.

## Surgical changes

A diff is earned line by line: every changed line traces to the request — a refactor whose earning event is this change traces through it. Remove only the orphans your own change created; pre-existing mess gets a mention, not a cleanup.

## Comments

A comment is earned by a constraint the code cannot show. Narration is never earned.
