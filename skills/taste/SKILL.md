---
name: taste
description: "Design a screen with taste: layout, type, colour, motion. Use when you build or restyle UI: a page, a component, a prototype. Not for the strings, which copy owns."
---

# Taste

The default is what a model draws when nobody decides. Taste is the set of decisions. Make every one before the first pixel, and look at the result before you report it.

```
read the brief -> write the plan -> advisor -> build -> screenshot -> advisor -> cut one thing -> done
```

## 1 — Read the brief

One line, in the conversation, before anything else:

```
Reading this as: <what it is> for <who opens it>, whose job here is <the one thing they do>.
It should feel <two words from the subject's own world>.
```

The subject's world is where the distinctive choices come from: its materials, its instruments, its printed matter. A ledger for accountants and a toy for eight-year-olds share no type, no palette and no motion.

Read the `## Product` section of the project's `CLAUDE.md`. It names the reader.

## 2 — Write the plan

Write the plan into the conversation, not into your head.

```
Palette   4 to 6 named hex values: ground, ink, muted ink, one accent, one line colour
Type      one family, or two that are clearly distinct. Roles: display, body, data
Layout    an ASCII wireframe of the route, and the alignment: left, centred, justified
The move  the one memorable thing on the page. Everything else stays quiet
```

Then read the plan back against one test: would the same plan come out for any brief in this category? Where it would, that part is a default, not a choice. Revise it and say what changed.

## 3 — Consult the advisor

The advisor is the stronger designer. That gap is why the call exists.

When the advisor tool is present, call it twice per design task, and no more. Each call replays the whole transcript at the advisor's rates.

| Call | After | It judges |
|---|---|---|
| 1 | the plan is in the conversation | the plan, against the brief |
| 2 | the screenshot is in the conversation | the rendered page |

The advisor takes no arguments. It reads the transcript. Put the thing to judge into the transcript first: the plan as a message, the screenshot through `Read`. A call with nothing to look at returns nothing to use.

A session that already runs on the advisor's model makes call 2 only.

Take the advice. Where it names a change, make the change before you build on.

## 4 — Build

Standards, not a checklist. Each one decides a fork.

| Axis | The standard |
|---|---|
| Hierarchy | Size, weight and contrast carry it. A box, a border, a divider or a number carries information, never decoration |
| Type | One family, two at most. One scale from one ratio. Lines under 80 characters. Sentence case |
| Colour | A neutral ramp and one accent, locked for the whole page. Colour carries state, and nothing else |
| Shape | One radius scale for the page. One shadow, tinted to the ground, or none |
| Space | One spacing scale. Group by space before you group by line |
| Theme | One theme per page. Where the project has light and dark, build both and look at both |
| Density | The reader's job sets it: a cockpit is dense, a reading page is airy. Numbers sit in a table, in tabular figures |
| States | Every screen has an empty, a loading and an error state. Build them with the happy one |
| Content | Real content, or fake data that looks lived in: `47.2%`, not `50%`; a name, not `John Doe` |
| Floor | Works at 375 and 1280 wide. Visible focus. Contrast passes AA. Reduced motion respected |

Spend the boldness in one place. The move from the plan is the one element that speaks. Everything around it stays disciplined.

Read `references/motion.md` when anything on the page moves. It holds the gate, the curves and the durations.

Read `references/page.md` when the page is a landing page, a marketing page or a portfolio. It holds the hero and the section rules.

The strings are copy. Load `copy` for them.

## 5 — Look at it

A page you have not seen is a page you have not designed.

1. Screenshot it at 1280 and at 375. `browser-evidence` drives the browser.
2. `Read` each PNG. Now it is in the transcript.
3. Walk the tells below. Fix what you see.
4. Advisor, call 2.
5. Remove one thing. There is always one.

## The tells

What a model draws when nobody decides. Each one is right for some brief and a default for every other. Where the brief asks for one, the brief wins.

| The tell | What it stands in for |
|---|---|
| Cream ground, serif display, terracotta accent | the palette that answers every "premium" brief |
| Near-black ground, one acid-green or vermilion accent | the palette that answers every "tech" brief |
| Purple-to-blue gradient, a glow, a mesh background | the accent nobody chose |
| Identical rounded cards in a row of three, one grey shadow each | grouping by box instead of by space |
| A tracked-out ALL-CAPS eyebrow above every heading | a label where the heading already says it |
| One word of a heading in italic, bold or a colour | emphasis the sentence did not earn |
| Middle dots between meta strings, an arrow after link text | template chrome |
| A big number, a small label, a gradient wash | the hero nobody decided |
| Fade-and-slide-up on every section, hover lift on every card | motion that answers no one |
| `John Doe`, `Acme`, `99.99%`, "Elevate", "Seamless" | content nobody wrote |
