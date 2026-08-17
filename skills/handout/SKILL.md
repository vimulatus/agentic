---
name: handout
description: Answer with one dark HTML page and publish it to Postplan. Use when the user asks for a plan, a report, or an interactive explainer - or when the answer is too long or too branched to read in chat. Not for a prototype, which has its own skill.
---

# Handout

One HTML file. Plain CSS. Dark. No build step. It lives in `/tmp` until Postplan has it.

Start from `template.html`. It carries the theme and the disclosure pattern. Colour carries state only.

## Pick the mode

| The user wants | Mode | The structure that carries it |
|---|---|---|
| A plan before the work starts | **Plan** | Phases. Each phase collapses to its outcome. |
| The findings of a long investigation | **Report** | The answer first. The evidence under it. |
| To understand how something works | **Explainer** | One toy the reader drives. |
| To see it before it is built | **Prototype** | → the `prototype` skill |

## Progressive disclosure

```
+-------------------------------------------+
|  The answer, in three lines               |  <- always open
+-------------------------------------------+
|  > Phase 1  Migrate the writer     done   |  <- <details>, closed
|  > Phase 2  Backfill the old rows    2d   |
|  v Phase 3  Cut the reader over      1d   |
|       the detail lives in here            |
+-------------------------------------------+
```

- Each closed row states its outcome in the `<summary>`. A reader who opens nothing still knows what happened.
- One idea per section. A section that needs a scrollbar is two sections.
- Open the first one. Close the rest.
- Sticky nav past five sections.
- Cite the source next to the claim: `src/pay/refund.ts:42`.

## Explainer

The reader moves an input and watches the output follow. A diagram nobody can touch is a picture, and a picture belongs in chat.

- One toy per idea. A slider, a toggle, a step button.
- Seed it in the interesting state, not the empty one.
- Show the intermediate value, not only the result. The middle step is the lesson.

## Publish

```bash
f=$(mktemp /tmp/handout-XXXX.html)   # write the page here
postplan upload "$f" --description "Refund backfill - 3 phases"
rm "$f"
```

Give the user the URL, and one line on what is inside. To revise the same page, pass `--draft <id>`.
