# UX

The small things are part of the feature. The reader should know what they can do, what just happened and how to recover. Follow the changed action through waiting, mistakes, interruption and return. Apply the rows it reaches; keep the surrounding product's conventions.

## Make the next action apparent

| When | The standard |
|---|---|
| A control repeats | Keep its meaning, placement and behavior consistent. Use native links for destinations and buttons for actions; preserve open-in-new-tab and browser Back |
| Something is interactive | Make it look actionable before hover. Give pressed, selected and expanded states distinct feedback. Keep the visible control and its hit area aligned; reveal ordinary actions without requiring a guessed gesture |
| A choice needs context | Keep labels, current selections, units and necessary constraints visible beside the choice. Put optional detail behind disclosure; keep prerequisites and consequences visible before commitment |
| A flow has steps | Show the current step and what remains. Back keeps prior answers. Frequent actions stay easy to reach; shortcuts supplement a visible route |
| An action is unavailable | Show the reason and how to unblock it near the control. An unexplained disabled button is a dead end |
| An action affects several items | Show the selection count and whether the scope is this page, selected items or all matches. Make clearing selection easy. After partial failure, distinguish what succeeded from what still needs action |

## Keep the reader's work

| When | The standard |
|---|---|
| Entering data | Persistent, associated labels; required or optional status; suitable input type, input mode and autocomplete. Accept paste and unambiguous formatting. Keep identifiers with leading zeros as text. Reuse information already supplied; let the reader correct it |
| Checking before commitment | For consequential submissions, show the actual values and scope before confirming. Let the reader edit the relevant answer and return to review with the rest intact; revisit only steps affected by that change |
| Validating | Default to validation on submit. Earlier feedback earns its place when it prevents wasted work. Keep entered values; associate errors with fields. On failed submit, focus the error summary for a long form, or the first invalid field for a short one |
| Waiting for an action | Acknowledge the press immediately, show pending state where it happened, and prevent duplicate submission while pending. Keep unrelated controls usable. A submitted request is still pending until its outcome is known |
| Work takes longer | Show measured progress when available, otherwise an honest activity state. Keep cancel or background continuation available when supported. Distinguish closing the view from stopping the work; make the eventual result findable |
| Loading or refreshing | Reserve the content's space. Keep usable results visible during refresh and distinguish stale data from new results. Late search responses cannot replace a newer query's results |
| An action succeeds or fails | Show the result near the action; use a toast when that result is elsewhere. Keep actionable errors available until resolved or dismissed. Preserve input and provide recovery. Failed optimistic changes need rollback or reconciliation; retrying an uncertain mutation needs protection against duplicate effects |
| A flow completes | Make completion unmistakable: what changed, where the result is and what happens next. Distinguish a saved draft, a submitted request and completed work |
| There are no results | Distinguish a new account, no matches and a failed load. Offer the relevant next action: create, clear filters or retry |
| Leaving and returning | Keep shareable filters, sorting and pagination in the URL; restore list position on return. Keep drafts through recoverable errors and Back. Warn on departure only when unsaved work would be lost; keep secrets and private drafts out of URLs |
| Removing or discarding | Make the affected item and scope clear. Prefer undo for reversible loss; confirm costly or irreversible loss before it happens. Cancel leaves data intact. Closing an editor must preserve its draft or explicitly handle discard |

## Make it operable

| When | The standard |
|---|---|
| Using a keyboard | Tab order follows the screen; focus stays visible and clear of sticky UI. Preserve native key behavior: Enter submits where the form supports it, inserts a newline in a textarea, and accepts an active choice in a picker. Respect text composition |
| Opening and closing | A modal gets an accessible name, deliberate initial focus, a contained Tab sequence and inert background. Escape and a visible close control leave it safely. Restore focus to its trigger, or a logical successor if that item disappeared. Menus and nonmodal popovers use their own keyboard pattern |
| Communicating state | Give icon buttons accessible names. Pair color with text or another cue. Announce relevant asynchronous status to assistive technology without moving focus; routine progress uses polite announcements |
| Touching, zooming or dragging | Aim for 44 by 44 CSS px touch targets as the house default, with space between neighbors. Keep browser zoom available. At narrow widths and enlarged text, keep labels, errors and actions reachable, including above the onscreen keyboard. Give drag actions a tap and keyboard alternative |
| Content varies | Try long names, large values and missing content. Wrap or disclose truncated essentials. Localize dates and numbers; show units and time zones where ambiguity changes the decision |

## Exercise the changed flow

Use the running UI with safe test data. Pick the applicable cases below and observe the outcome; a code read or screenshot alone does not verify them.

| Try | Observe |
|---|---|
| Complete it with keyboard alone; open, cancel and reopen an overlay | Reachable controls, appropriate key behavior, visible focus and sensible return focus |
| Submit invalid input, correct it, then force a failed request and retry | Discoverable errors, retained values and a recoverable outcome |
| Delay the response and activate twice; change a search while it loads | Pending feedback, one mutation and results for the current query |
| Navigate away and Back; refresh a shareable view; cancel a destructive action | Preserved context, honest draft handling and unchanged data after cancellation |
| Correct an earlier answer; change a bulk selection; leave a long-running task | Relevant steps revisited, explicit action scope and a findable outcome |
| Use the narrow layout, enlarged text, no matches and long content | Reachable actions and readable content without clipping essentials |

Fix failures within the changed flow. State the cases exercised and any runtime or assistive-technology behavior that remains unverified. This pass supports the accessibility floor; it is not a full conformance audit.
