---
name: product-truth
description: Learn who the end user is and what they decide, write it to PRODUCT.md, then build every end-user surface from it. Use when building or changing a screen, a chart, a dashboard, an empty state, or user-facing copy - and when the user asks who something is for. Not for palettes, typography or component choice, which belong to frontend-design and dataviz.
---

# Product truth

```
   the repo ──> the 3 gaps ──> PRODUCT.md ──> what goes on the screen
                    │                              │
              ask only these              name the reader's decision,
              only when the repo          or the thing does not ship
              cannot answer them
```

You cannot cut a screen down until you know who reads it. PRODUCT.md holds that, once, for every later session.

## 1. Read the repo first

He should never repeat a fact his own code already states. Before you ask anything, read the product docs and copy, the routes, the roles, the domain models, the names in the schema.

Repo evidence is a **hypothesis**, not his approval. Bring it to him as one, and confirm it.

## 2. Ask at most three

Only for the gaps the repo left. Use `AskUserQuestion`, one round.

| # | The question | Why it earns a round |
|---|---|---|
| 1 | Who is the primary user, in what situation, doing what job? | Decides what belongs on a screen at all |
| 2 | What does the product make possible, and what is different about how? | Decides what the screen leads with |
| 3 | What facts, terms or commitments must future work preserve? | Stops the next session relitigating a settled call |

Record an undecided fact as undecided. An invented answer outlives the session that invented it.

## 3. Write PRODUCT.md

At the project root. If the project already has one, update that file instead. A second authority is worse than a stale one.

```markdown
# Product

## Users          who they are, the situation they are in, the job they are doing
## What it does   the purpose, and what counts as success
## How they work  the workflow, the tools it sits beside, the words their trade uses
## Constraints    durable facts, terminology and commitments future work preserves
## Open           what nobody has decided yet
```

| Belongs here | Belongs elsewhere |
|---|---|
| Users, jobs, workflows, operating context | Palettes, typography, spacing → `frontend-design` |
| Capabilities, constraints, the trade's vocabulary | Chart form and color → `dataviz` |
| Confirmed voice, real assets, real data | Page concepts and layout |
| Open questions, marked open | Invented users, testimonials, benchmarks, pricing |

Write it plainer than the subject deserves. A sentence that performs insight, like "a guess wearing the costume of a design", is the register this skill exists to stop.

## Build from it

Before a number, a chart or a sentence reaches an end-user surface, name the decision the reader makes with it.

```
Days of cover on the stock screen
  reader   the shop owner
  decides  reorder now, or wait
  ships    yes

"The line breaks across days with no runs, so empty and error-free
 do not draw at the same height"
  reader   the shop owner
  decides  nothing. This is how you handled empty days.
  ships    no
```

Ship the conclusion, not the reasoning that produced it. The reader was not in the room where you made the call, and does not need to be.

The same test governs your chat replies (`cheat-sheet`) and every string you write (`unslop`): **delete a line if it does not change what the reader does next.** PRODUCT.md is what makes the test answerable, because it names the reader.

## Done

- [ ] PRODUCT.md exists, and every fact in it is confirmed or marked open.
- [ ] Each number and chart on the surface has a reader decision you can name.
- [ ] No string on the surface explains a choice you made while building it.
