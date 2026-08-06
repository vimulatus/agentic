---
name: reset
description: Declare a design bankrupt and replan from scratch, salvaging only what survives. Use when a plan or grill is circling — the same problem patched again and again without progress — when the user wants to scrap the current design and start over, or when another skill needs the bankruptcy procedure.
---

A design that keeps getting patched around a dead assumption is **insolvent**: what it still holds true can no longer cover what it promises. Patching an insolvent design is the circling. Bankruptcy is the procedure that ends it — discharge the design, salvage what is exempt, replan from the salvage alone.

## 1. Insolvency test

Both conditions must hold:

- A **load-bearing** assumption is dead. Test: does removing it change what the parts *are*, or only what one part *does*? Only the former is load-bearing.
- The next fix would add a special case rather than remove one.

One without the other is ordinary iteration. Say which condition failed, and carry on with the work — do not run the rest of this skill.

If the user invoked this skill by name, they have already made the call. Name the dead assumption and the patch you were about to make, then continue regardless.

Done when: the dead assumption and the pending patch are both named, and either both conditions hold or the skill has ended.

## 2. Salvage

Three classes of thing are **exempt** from discharge:

- **The problem statement**, corrected by what the grill taught you.
- **Verified facts** — anything found in the codebase, the docs, or a primary source. Cite where each came from.
- **Dead ends, each with the reason it is dead.** The most valuable asset in the estate: without the reasons, the replan walks straight back into them.

Decisions the user confirmed are not automatically exempt. Test each one: would they still make it knowing nothing about the discarded design? Those that pass become constraints on the replan. Those that don't are listed as **re-opened**, with the reason they were re-opened — never dropped in silence.

Everything else is discharged: the architecture, the parts breakdown, the interfaces, and the one that hides — the **vocabulary**. A noun that exists only because of the dead design smuggles it into the replan. Rename it in problem terms or drop it.

Write the salvage into a handoff document, per the `handoff` skill.

Done when: every confirmed decision appears in the document as either an exempt constraint or a re-opened item with its reason, and no noun in the document exists only because of the dead design.

## 3. Diagnose

Bankruptcy is an outcome, not a cause. Name the dominant reason the design went insolvent — that choice picks the restart:

| Why it went insolvent | Restart |
| --- | --- |
| The problem was wrong — the design answered a question we no longer have | Re-grill from the corrected problem statement, per the `grilling` skill |
| One mechanism was picked too early, and everything since was built inside it | Hand the salvaged spec to the `clean-room-planning` skill |
| Too big to hold at once — decisions in one area kept invalidating another | Split into sub-problems that can be settled independently; name the seam between them and plan each on its own |
| The constraints contradict each other — no design can satisfy them | Take the contradiction back to the user and renegotiate the constraints before any replanning |

Record the cause and the restart in the salvage document.

Done when: exactly one cause is named and its restart is written into the document as the next session's task.

## 4. Restart clean

The discharged design is still in this context, anchoring everything said after it. Hand the salvage document to a fresh session and run the restart there, so the replan sees the document and nothing else.

If the user chooses to stay in this conversation instead, say plainly that the discharged design is still in context, then re-read the salvage document and work from it alone.

Done when: the document's path is handed over for a fresh session, or the user has declined and the discharged design has been named aloud as a live anchor.
