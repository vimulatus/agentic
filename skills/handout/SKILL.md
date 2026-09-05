---
name: handout
description: Answer with one HTML page. Use when Vasu asks for a report or an explainer, or the answer is too long for chat. Not for a prototype, nor for work to build, which wayfinder tickets.
---

# Handout

One HTML file. Plain CSS. Dark. No build step.

Start from `template.html`. It carries the theme and the disclosure pattern. Colour carries state only.

Load `taste` for the layout, the type and the advisor calls. The template carries the chrome; `taste` decides what goes inside it.

## Pick the mode

| The user wants | Mode | The structure that carries it |
|---|---|---|
| A plan to read: a migration, a rollout, a sequence of phases | **Plan** | Phases. Each phase collapses to its outcome. |
| A plan to build from | → the `wayfinder` skill. It tickets the slices; the page shows them | |
| The findings of a long investigation | **Report** | The answer first. The evidence under it. |
| To understand how something works | **Explainer** | One toy the reader drives. |
| To understand a topic they are new to | **ELI5** | Big pictures. Few words. One idea per screen. |
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

## ELI5

The reader knows nothing about the topic. Assume no term, no acronym, no background.

- The picture carries the idea. The words label the picture.
- One idea per screen. A screen with two ideas is two screens.
- Name each thing with a word from the reader's life, then give the real term once, in brackets.
- Cut every sentence that only a person who already knows the topic can read.

## Explainer

The reader moves an input and watches the output follow. A diagram nobody can touch is a picture, and a picture belongs in chat.

- One toy per idea. A slider, a toggle, a step button.
- Seed it in the interesting state, not the empty one.
- Show the intermediate value, not only the result. The middle step is the lesson.

## Deliver

Write the page to `${TMPDIR:-/tmp}/vimulatus/handouts/<task>.html`, never into the repo. The page commits to dark: `:root` sets `color-scheme:dark`, and `body` paints its own background.

Read only the delivery reference that matches the available capability:

- An Artifact tool that publishes HTML is available: read [references/artifact.md](references/artifact.md).
- Otherwise: read [references/local.md](references/local.md) for a complete standalone HTML file.

Give Vasu the resulting URL or file link, and one line on what is inside. Revise the same file when the page changes.
