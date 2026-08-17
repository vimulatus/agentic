---
name: retro
description: Explain why Claude made a choice in this session, then fix the document that caused it. Use when the user asks why you did that, what went wrong, or how to stop it happening again - and after a session where the user corrected you more than once. Not for debugging code.
---

# Retro

This session only. The transcript is already in context. Read it, do not parse files.

## The trap

A reason you invent now sounds true and is not. Quote the evidence or drop the claim.

Cite every cause with the turn it came from: the user's words, the tool result, the instruction line. A cause with nothing to quote is a guess, and you say so.

Where compaction dropped the turn, say "I cannot recover this" and move on.

## 1. Find the misses

The user's corrections are the labels. Every push-back marks a decision worth examining.

- "no", "that is wrong", "too much", a rewritten instruction, a reverted edit
- a question the user had to ask twice
- a step you redid

Three at most. Take the ones that cost the most time.

## 2. Name the cause

For each miss: quote the trigger, state what you did, then pick one cause.

| Cause | Test |
|---|---|
| Ambiguous prompt | Two readings existed. You picked one. |
| Missing instruction | No document held the house choice. |
| Buried instruction | The line existed. You had it. You did not apply it. |
| Wrong default | You applied a general habit over a stated house choice. |
| Bad evidence | You acted on a stale tool result, or on a file you never read. |
| Context loss | The fact was in a turn that compaction dropped. |

## 3. Fix the right thing

Each cause has one home. Adding a rule to `CLAUDE.md` for every miss is how that file dies.

| Cause | Fix |
|---|---|
| Ambiguous prompt | None. Say so. It is a one-off. |
| Missing instruction | One line in `CLAUDE.md` or the skill that owns the branch. |
| Buried instruction | Rewrite the line that lost. Do not add a second one. |
| Wrong default | One house-choice line, stated as the positive. |
| Bad evidence | A workflow change, not a document. Name the step you skipped. |
| Context loss | A workflow change. Name what to restate before the context fills. |

**None** is a real answer. Give it when the miss will not repeat.

## 4. Report

Per miss, four lines:

```
Miss    what you did
Trigger "<quote from the turn>"
Cause   <one from the table>
Fix     <the exact edit, or None>
```

Write the fix as the exact text and the file it belongs in. Stop there. The user decides what lands.

When the user asks for the edit, route it through `context-engineering`.
