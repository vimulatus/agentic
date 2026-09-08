---
name: prototype
description: Build a single-file HTML prototype. Use when Vasu wants to see a flow, a state machine, or a screen before it is built. Not for production code.
---

# Prototype

Load `handout` first. Its template, its theme and its Deliver step are yours. This skill is the mode the reader drives.

## Pick the branch

Match the surrounding code. Do not ask.

| Code you are in | Branch | Artifact |
|---|---|---|
| Backend, service, state machine, flow | **Logic** | Driveable simulator |
| Frontend, component, page, layout | **UI** | Variant switcher |

Spans both: build Logic, say why.

## Logic

A non-dev drives the state machine through the cases that are hard to reason about on paper.

```
+---------------------------------------------+
|  STATE: awaiting_payment   attempts: 2       |  <- state and log stay visible
+---------------------------------------------+
| Free play                                    |
|  [pay] [timeout] [refund] [webhook: dup]     |
+---------------------------------------------+
| Walkthroughs   (tab) (tab) (tab)             |
|  1. Duplicate webhook after refund   [Run]   |
|  2. Timeout races capture            [Run]   |
+---------------------------------------------+
| Event log                                    |
|  > pay      awaiting -> capturing            |
|  > webhook  capturing -> paid                |
+---------------------------------------------+
```

- One button per event. Disable the illegal ones, and keep them visible.
- One walkthrough tab per hard case. Each step names what it sends and what it expects.
- Label in the user's words: "Card declined", not `PAYMENT_FAILED`.
- Reset button.

## UI

Load `taste` for design guidance and its advisor calls on material visual design tasks.

Several **radically different** takes on one route, fast to flip between.

```
?v=0            ?v=1            ?v=2
+---------+     +---------+     +---------+
| dense   |     | wizard  |     | canvas  |
| table   |     | 1 step  |     | cards   |
+---------+     +---------+     +---------+

        floating bottom bar
        [<]  2 / 5 - "Wizard"  [>]
```

- 3 to 5 variants. Different structure, not different colors. If two swap in your head, one is wasted.
- `?v=<n>` is the share link. The arrows wrap. The arrow keys work.
- Same fake data in every variant.

## Skip the polish

| Do | Skip |
|---|---|
| Hardcoded fake data | Real APIs, auth, a backend |
| Legible type and spacing | Animation, icon sets |
| Check the demonstrated flow in one browser, at narrow and wide widths, including keyboard use | Production test infrastructure, a full accessibility audit, live persistence and backend failure tests |

Use taste's basic responsive and keyboard floor. Exercise the interactions and simulated states this prototype demonstrates; report its limitations.

Deliver it through `handout`'s applicable delivery reference and give the resulting URL or file link. On Vasu's own machine, open the file as well. Never a TUI, never a hosted planning tool: one HTML file he can open.
