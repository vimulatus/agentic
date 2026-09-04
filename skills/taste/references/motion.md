# Motion

Motion is a decision, in this order. Steps 1 and 2 gate the rest: most motion stops there, with zero lines written.

## 1 — Should it move at all?

| The reader sees it | Decision |
|---|---|
| 100+ times a day: a keyboard shortcut, a command palette | No animation. Ever |
| Tens of times a day: hover, list navigation | Near-imperceptible, or nothing |
| Now and then: a modal, a drawer, a toast | Standard |
| Once: onboarding, a success, a celebration | The delight lives here |

A keyboard-initiated action never animates. Raycast has no open animation, and that is correct for something opened hundreds of times a day.

## 2 — What is it for?

Name one before you continue: **feedback**, **spatial consistency**, **state indication**, **preventing a jarring change**, **explanation**, or **delight** at the once tier. No word, no motion. Data the reader is reading or acting on never moves for style.

## 3 — The cheapest tool that works

| Need | Tool |
|---|---|
| Hover, press, colour, a state you toggle with a class | CSS transition |
| An entrance on mount, no JS state | CSS `@starting-style` |
| Predetermined motion that must stay smooth while the page loads | CSS animation, off the main thread |
| Programmatic control with CSS performance | WAAPI, `element.animate()` |
| A spring, a layout animation, an exit, a gesture | Motion, `motion/react` |

## 4 — The properties

- `transform` and `opacity`. They skip layout and paint. `width`, `height`, `margin`, `padding`, `top`, `left` trigger all three. `clip-path` is the sanctioned exception; `height` is tolerated only for an accordion.
- Enter from `scale(0.95)` and `opacity: 0`, never `scale(0)`. Nothing in the world appears from nothing.
- A popover, a menu, a tooltip scales from its trigger: `transform-origin` at the trigger. A modal is not anchored, so it stays centred.
- Percentages in `translate()` are relative to the element's own size. `translateY(100%)` moves it by its own height.

## 5 — Curve and duration

| Situation | Easing |
|---|---|
| Entering or exiting | ease-out |
| Moving or morphing on screen | ease-in-out |
| Hover, colour | ease |
| Constant motion: marquee, progress | linear |

`ease-in` never touches UI. It delays the moment the reader is watching. The built-in curves are weak; use these:

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

| Element | Duration |
|---|---|
| Button press | 100–160ms |
| Tooltip, small popover | 125–200ms |
| Dropdown, select | 150–250ms |
| Modal, drawer | 200–500ms |

UI stays under 300ms. A 180ms dropdown feels faster than a 400ms one. A spring replaces the pair when the motion is a drag, a gesture the reader can reverse, or something that should feel alive: `{ type: "spring", duration: 0.5, bounce: 0.2 }`, bounce between 0.1 and 0.3.

## 6 — Interruption and exit

- A transition, not a keyframe, for anything the reader can fire twice in a second. A transition retargets from where it is; a keyframe restarts from zero.
- Exit the way it entered. A toast that slides in from the bottom leaves through the bottom.
- Slow where the reader is deciding, fast where the system responds: a hold-to-confirm at 2s linear, its release at 200ms ease-out.
- A group entering together staggers by 30 to 80ms, and never blocks interaction while it plays.

## 7 — Ships with the animation

```css
@media (prefers-reduced-motion: reduce) { .el { animation: fade 200ms ease; } }  /* keep opacity, drop movement */
@media (hover: hover) and (pointer: fine) { .el:hover { transform: scale(1.05); } } /* touch fires hover on tap */
```

Reduced motion means gentler, not none.

## Press feedback

Every pressable element answers the press: `transform: scale(0.97)` on `:active`, `transition: transform 160ms var(--ease-out)`. Name the property. `transition: all` animates what you did not mean to.
