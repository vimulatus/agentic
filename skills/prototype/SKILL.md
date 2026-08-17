---
name: prototype
description: Build a single-file HTML prototype and publish it to Postplan. Use when the user asks to prototype, mock up, explore variants, or "show me" a behavior before it is built - for backend state machines and flows (Logic branch) or for screens and layouts (UI branch). Not for production code.
---

# Prototype

The shell, the theme and the publish step come from the `handout` skill. This is the mode the reader drives.

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
| Works in one browser | Responsive, a11y audit, tests |

Publish it the way `handout` publishes: `postplan upload "$f" --description "Refund state machine - 3 edge cases"`.
