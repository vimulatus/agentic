---
name: polish
description: Walk a shipped web flow in the browser and measure each moment after an action - where the result landed, what moved, what waited, where focus went, what transitions ran - then report the measurements for Vasu to pick from. Use when Vasu says polish pass, or asks to polish a flow or the app. Not for bugs, which bug-hunt owns, nor for design direction or a screen to design, which taste owns.
---

# Polish

Resolve `<skill-dir>` from this skill's loaded `SKILL.md` path. Substitute that absolute directory in script commands, even after changing working directories.

You measure. Vasu judges. Someone else fixes.

Polish has two halves. One is mechanical: the result of an action landed off screen, a sibling moved, focus fell to the body, a hover faded. You find those with instruments, and each finding is a number against a rule in `taste`. The other half is felt, and you do not have the hand or the eye for it. That half reaches Vasu as one recording he watches once. Do not report a feeling.

```
scope ──> browser-evidence setup, with the observer ──> one action at a time: act, wait, read the moment ──> report ──> file, on Vasu's word
```

`browser-evidence` owns the server, the session, auth, capture, hosting and embedding. Load it first. `agent-browser skills get core` holds the commands.

## Scope

Vasu names a flow, or the slice that just shipped. Read the project's `## Product` section for who the user is, then walk the flow as that user, one action at a time. No flow named: the flow the last merged PR changed.

Findings come from the running page. Do not read the app's source; the report describes what was measured, and the investigator owns the cause.

## The observer

Register the observer on the command that launches the session, before any navigation. It then follows every tab of the session. A session that is already open needs a close and a reopen with the flag, or `__polish` stays undefined:

```bash
agent-browser --session <task> --init-script "<skill-dir>/scripts/observe.js" open <url>
```

After each action, wait for the page to settle, then read the moment. Pass the selector of the element the action should have produced or revealed:

```bash
agent-browser --session <task> eval "JSON.stringify(__polish.moment('#new-row'))"
```

The header of `observe.js` documents every field. Chromium only for `shifts`; movement done with `transform` does not register there, so a still before and after covers it.

## The instruments

Each row is a `taste` rule made measurable. Read the moment, compare, and record only the rows the action reaches.

| After | Read | The rule it checks |
|---|---|---|
| any action that produces or reveals something | `target.inView`, `target.centreOffsetPct`, `scroll.atEnd` | the reader must find the result without searching. Off screen is a finding. Far from centre with `atEnd` true means the page was too short to bring it in, which is the case for temporary bottom space |
| any action | `shifts` | nothing the reader did not touch moves. A moved sibling that is not the target is a finding, with its `dy` |
| a press | `firstChangeMs`, and the state it changed to | the press is acknowledged at once, and a pending state shows where it happened. Record the number; `taste` sets no threshold, so Vasu reads it |
| a dialog, sheet or menu closes | `focus`, `focusIsBody` | focus returns to the trigger or a logical successor. Focus on `body` is a finding |
| a hover over a nav item or a list row | `target.transition.duration` | instant. Any duration above `0s` is a finding |
| a routine entrance: dropdown, tooltip, toggle, sheet | `target.animation.duration`, `target.transition.duration`. shadcn overlays animate with keyframes on `data-state`, so read both | under 300ms, per `motion.md`; a modal or drawer may take up to 500ms |
| a number that changes while shown | `target.fontVariantNumeric`, and its `rect.w` before and after | tabular figures, per `type.md`. A width change is a finding |
| a keyboard shortcut | `firstChangeMs`, `target.animation.duration`, `target.transition.duration` | immediate, no entrance |

Two passes over the same flow: pointer, then keyboard alone. The keyboard pass is where focus findings live.

Record the whole flow once, at 1x, per `browser-evidence`. That recording is the felt half, and it goes at the top of the report for Vasu.

## The report

Write to `${TMPDIR:-/tmp}/vimulatus/<task>/report.md`, one finding at a time as you go. Host every shot and the recording, and embed them by the `browser-evidence` Embed table.

Open with the recording, then a table of the findings: title, the rule, the measurement, where. Each finding is one issue body in the shape `to-tickets` files, with the measurement in place of a repro narrative:

```markdown
## The new project lands at the bottom edge after Create

**Rule:** taste › ux › A flow completes: where the result is
**Where:** <URL>

### Current behaviour

After Create, the new row sits at the bottom edge of the viewport. The page has no further scroll, so the browser cannot centre it.

### Measured

    target.rect        y=413 h=47   viewport h=500
    centreOffsetPct    +37
    scroll             y=215 max=215 atEnd=true
    firstChangeMs      122

![after create: the new row at the bottom edge](<url>)

### Expected behaviour

The new row is centred in the viewport with a brief mark.

### Possible solution

- Add bottom padding to the page for the scroll, and remove it once the reader scrolls.
```

The title names what the reader sees, in the user's words. The `Possible solution` is one bullet, or absent. Someone else builds it.

## Done

Close your session per `browser-evidence`. Then report to Vasu: the path of the report, the recording, the findings table, and the one finding that matters most.

Vasu says file: `to-tickets`, one issue per finding, skipping its read-the-code step. The `##` line is the title; the rest of the block is the body.

- [ ] Every finding carries a measurement and names its `taste` rule.
- [ ] No finding is a feeling. What only an eye can judge is in the recording, not in a finding.
- [ ] The keyboard pass ran.
- [ ] Your session is closed, and any server you started is stopped.
