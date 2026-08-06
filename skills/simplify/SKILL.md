---
name: simplify
description: Refactor-only cleanup of the current change — strip slop (dead comments, deep nesting, unearned abstractions) without altering behavior. Use after tests pass and before opening a PR; when the user wants to simplify, deslop, or clean up recently changed code.
---

# Simplify

Strip the **slop** out of the change you just made — without touching what it does.

## The one hard constraint: behavior-preserving

You may change structure, names, and comments. You may **not** change behavior. Same output for every input, same error behavior.

**Done when the full suite is still green.** Run it after your edits. If a test goes red, your simplification *is* the bug — revert it, never edit the test to fit.

## Scope: the diff only

Work on `git diff` against the base. No drive-by refactors of untouched code — those bloat the diff and add regression risk the task didn't ask for.

## Delete, don't rearrange

Prefer removing a moving piece — a whole branch, a wrapper, a flag, a layer — over relocating the same complexity somewhere tidier. A refactor that just spreads the complexity around isn't a simplification. The best one makes the code feel inevitable in hindsight.

## The slop checklist

- **Narrating comments** — remove comments that restate what the code already says, or clash with local style. Keep only comments that explain a constraint the code can't show.
- **Abnormal defensive code** — try/catch and null-guards that don't match how this codebase treats a trusted internal path.
- **`any`-casts** — ones that only paper over a type error; fix the type instead.
- **Deep nesting** — flatten with early returns and guard clauses.
- **Unearned abstractions** the change introduced — thin wrappers, pass-through helpers, one-off options, speculative generality. Judge these with **earned-abstractions**; inline them back until a real need shows.
- **Dense cleverness** — ternary/reduce chains that need mental parsing become explicit named steps. Clarity over brevity.
- **Local inconsistency** — patterns that clash with the surrounding file.

## Output

Minimal, focused edits over broad rewrites. Report what you removed in 1–3 sentences.
