# Feature request

*Currently* is the hardest beat here — a missing feature has no failing output to paste. Use the **workaround**: what someone does today to get the result they want. That is the concrete failure.

## Skeleton

```markdown
## Currently

What a user has to do today to achieve this, and why that's bad. Name the
workaround. If there's a screen or a command involved, show it.

## Expected

The behaviour you want, described from the outside — what the user does and
what they get. Not how it's built.

## Proposed Solution

The direction: where it lives, what it touches. One paragraph.

## Out of scope (optional)

One line each. What this deliberately doesn't cover, so nobody widens it.
```

## Filled example

```markdown
## Currently

Closing a shift needs the previous shift's closing meter readings, but the
close screen doesn't show them. Operators keep a paper notebook and retype
the numbers, so a typo silently changes the day's sales volume.

## Expected

The close screen pre-fills each nozzle's opening reading from the previous
shift's close. The operator only enters the closing reading.

## Proposed Solution

Read the last closed shift for the pump on load and use its closing readings
as defaults. Keep the field editable — a meter can be replaced mid-shift.

## Out of scope

- Blocking a close when the reading goes backwards. Separate concern.
- Meter replacement history.
```
