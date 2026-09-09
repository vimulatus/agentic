---
name: taste
description: "Design how UI looks and behaves. Use when building, changing or reviewing screens and interactions, including small UI fixes. Copy owns the strings."
---

# Taste

Make design choices that fit the reader's task and the subject's world. Read the project's `## Product` section for the audience. For an existing UI, keep the established design and change only what the task needs. A review reports findings in the requested scope.

## Design decisions

For a new screen or material visual redesign, share the choices that affect the result: palette, type roles, layout, the distinctive element, and changed interaction states. Include a wireframe when it resolves a layout question. Derive these choices from the subject rather than a generic category style.

A behavior fix needs the affected action's pending, success, failure and recovery behavior, including retained input and focus. It does not need a new visual direction or a narrated design plan.

## Advisor

When the advisor tool is present, use two calls for a new screen or material visual redesign: one to review the design direction before building, and one to review the rendered result. This is the design task's review budget. Small behavior fixes and scoped reviews do not require these calls.

Use the tool schema to supply the brief and the material being reviewed. If it reads the transcript, put the design choices there and display the screenshot with the available image tool before the corresponding call.

Assess advice against the brief and established design. Apply relevant improvements; explain a material trade-off rather than accepting conflicting advice automatically.

## Build

Standards, not a checklist. Each one decides a fork.

| Axis | The standard |
|---|---|
| Hierarchy | Size, weight and contrast carry it. A box, a border, a divider or a number carries information, never decoration |
| Type | One family, two at most. One scale from one ratio. Lines under 80 characters. Sentence case |
| Colour | A neutral ramp and one accent, locked for the whole page. Colour carries state, and nothing else |
| Shape | One radius scale for the page. One shadow, tinted to the ground, or none |
| Space | One spacing scale. Group by space before you group by line |
| Theme | One theme per page. Where the project has light and dark, build both and look at both |
| Density | Minimal by default: what the job needs now on the screen, the rest one tap away. Where the job is dense, the table is dense and the page around it is not. Numbers sit in a table, in tabular figures |
| Disclosure | Optional explanations open on tap and on keyboard, anchored to their trigger: a popover, an accordion, a sheet. Prerequisites and consequences stay visible before commitment. Hover has no thumb |
| Components | shadcn/ui is the house look. React installs it, the rest borrows the look, and the tokens come from the project's install |
| States | Build the affected empty, loading and error states alongside success. Name the recovery before implementing the action |
| Content | Real content, or fake data that looks lived in: `47.2%`, not `50%`; a name, not `John Doe` |
| Floor | Works at 375 and 1280 wide. Visible focus. Contrast passes AA. Reduced motion respected |

Spend the boldness in one place. The distinctive element is the one that speaks. Everything around it stays disciplined.

Read `references/motion.md` when anything on the page moves. It holds the gate, the curves and the durations.

Read [references/ux.md](references/ux.md) before building or reviewing controls, forms, navigation or asynchronous updates, including on landing pages. Apply the rows the changed interaction reaches, then exercise them before reporting done.

Read `references/app.md` when the page carries a chart, or the page is a dashboard, a list, a resource view, a form or settings. It holds the page shapes, the disclosure containers and the charts.

Read `references/landing.md` when the page is a landing page, a marketing page or a portfolio. It holds the hero and the section rules.

The strings are copy. Load `copy` for them.

## Use it, then look at it

A page you have not seen is a page you have not designed. A screenshot cannot prove an interaction works.

1. Exercise the changed flow, including keyboard use and a relevant failure and recovery. Follow the verification table in `references/ux.md` when it applies. `browser-evidence` drives the browser.
2. Screenshot it at 1280 and at 375.
3. View each PNG with the available image tool. Now it is in the transcript.
4. Walk the tells below. Fix what you see.
5. Use the second advisor call for a new screen or material visual redesign.
6. Remove decoration that does not serve the brief. Keep labels, feedback and recovery controls.

Report what you exercised and what remains unverified. A static prototype can demonstrate states; live persistence and failure recovery need a working implementation.

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
| Four stat cards in a row, each with an icon, a sparkline and a green arrow | the dashboard nobody decided |
| Help that shows on hover | an explanation the phone never gets |
| Fade-and-slide-up on every section, hover lift on every card | motion that answers no one |
| `John Doe`, `Acme`, `99.99%`, "Elevate", "Seamless" | content nobody wrote |
