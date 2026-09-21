# Motion

Motion is a decision, in this order. Steps 1 and 2 gate the rest: most motion stops there, with zero lines written.

## 1 — Should it move at all?

| The reader sees it | Decision |
|---|---|
| Many times a day: a keyboard shortcut, a command palette, hover, list navigation, a panel flipped forty times a day, however it is opened | Immediate. No decorative entrance or exit; motion stays only where it explains a meaningful state or spatial change without delaying the next action. A highlight that follows the pointer gets no transition: a cursor crosses ten nav items a second, and a fade leaves the interface a few frames behind it |
| Now and then: a modal, a drawer, a toast | Standard |
| Rare or first-time: onboarding, a milestone | Room for expressive motion when it serves the moment |

Frequency is a judgment about the workflow, not a measured quota. Routine success is not an occasion for celebration.

## 2 — What is it for?

Name one before you continue: **feedback**, **spatial consistency**, **state indication**, **preventing a jarring change**, **explanation**, or **delight** at the once tier. No word, no motion. Data the reader is reading or acting on never moves for style.

## 3 — The cheapest tool that works

| Need | Tool |
|---|---|
| Hover, press, colour, a state you toggle with a class | CSS transition |
| An entrance on mount, no JS state | CSS `@starting-style` when supported by the project's browser targets |
| Predetermined motion | CSS animation |
| Programmatic playback control | WAAPI, `element.animate()` |
| Velocity-aware springs or complex gesture handoff | The project's animation library; Motion when a library is needed and none is established |

## 4 — The properties

- Prefer `transform` and `opacity` to avoid layout work. Compositing depends on the browser, content and effect; CSS, WAAPI and library APIs do not guarantee off-main-thread execution. Profile consequential motion under realistic load. Animate layout only when the changing geometry communicates something useful, such as an expanding accordion; inspect clipping and blur for paint cost.
- If scaling an entrance, start near its resting size, such as `scale(0.95)`, with opacity. Avoid collapsing ordinary UI to `scale(0)`.
- A popover, a menu, a tooltip scales from its trigger: `transform-origin` at the trigger. A modal is not anchored, so it stays centred.
- Percentages in `translate()` are relative to the element's own size. `translateY(100%)` moves it by its own height.

## 5 — Curve and duration

| Situation | Easing |
|---|---|
| Entering or exiting | ease-out |
| Moving or morphing on screen | ease-in-out |
| Colour, where it transitions at all | ease |
| Constant motion: marquee, progress | linear |

Favor immediate response over slow starts. Inherit the project's curves; these are house starting points when it has none. Judge them at the actual travel distance and duration:

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

Routine UI transitions stay under 300ms; modal and drawer transitions may use the table's 200–500ms range. These are starting ranges, not waits before input becomes usable. Springs default to no overshoot; add restrained bounce when momentum or the product's character justifies it. Library spring parameters are not interchangeable physics constants.

## 6 — Interruption and exit

- Prefer transitions for rapidly toggled states: retarget from the current appearance. For programmatic animation, explicitly preserve continuity when cancelling or reversing. Do not lock out input to let an animation finish.
- Continuity holds through the transition. A thing exits the way it entered and returns to where it came from, at that place's current position if the page scrolled. The cursor keeps its shape until a morph ends: the field takes `pointer-events: none` while it transitions.
- Slow where the reader is deciding, fast where the system responds: a hold-to-confirm at 2s linear, its release at 200ms ease-out.
- Stagger only when sequence helps comprehension or a rare expressive entrance. Keep any offsets short and the total reveal brief; routine lists appear ready to use. Never block interaction while a stagger plays.

## Gestures

Read this section when implementing drag, swipe or sheets. Prefer established accessible components before inventing gesture handling.

- While held, follow the pointer directly and preserve the grab offset. Spring lag belongs in decorative tracking or release motion, not between a functional control and the finger.
- Capture the active pointer; ignore other pointers and handle cancellation and lost capture. Distinguish scrolling from dragging before committing, and preserve ordinary page scrolling outside the gesture's axis.
- Estimate release velocity from recent movement, with explicit units and direction. Choose a permitted snap or dismissal target using position and momentum; a quick flick should not need the same travel as a slow drag. Tune to the component instead of copying a universal threshold.
- Hand release position and velocity to an animation that supports them. Re-grabbing or reversing starts from the current on-screen position without a jump; preserve velocity where the animation API supports it.
- Use progressive resistance at a soft boundary when it clarifies the limit. Provide tap and keyboard alternatives with the same outcomes.

## 7 — Ships with the animation

For `prefers-reduced-motion: reduce`, remove nonessential travel, scale, parallax and bounce. Use immediate state changes or a short opacity/color transition where it aids comprehension. Override both animations and transitions; do not remove a transform that is needed to position the element. Feedback remains available without motion.

Gate decorative hover motion with `(hover: hover) and (pointer: fine)`; touch and keyboard retain their own feedback.

Exercise rapid toggle, reversal and dismissal at normal speed. Inspect awkward motion slowed down or frame by frame for jumps, incorrect origins and unsynchronized properties, then restore normal timing. Check reduced motion and realistic load. For gestures, test touch input and cancellation; report when physical-device behavior remains untested.

## Press feedback

Give immediate press feedback using the component's established treatment. A subtle scale around `0.97` suits standalone buttons; a surface or border change can fit dense controls better. Keyboard activation gets immediate state feedback without decorative scale. Name the transition properties rather than using `transition: all`.
