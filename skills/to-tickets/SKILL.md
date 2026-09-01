---
name: to-tickets
description: Turn a plan, spec, or the current conversation into one parent issue with a sub-issue per tracer-bullet ticket, wired with GitHub's native sub-issue and blocked-by edges. Use when the work is bigger than one ticket. Not for a single bug or chore, which goes straight to `dev`.
disable-model-invocation: true
---

# To Tickets

One **parent issue** holds the work. One **sub-issue** per **ticket**: a tracer-bullet vertical slice, sized for one context window.

```
parent #12  Feedback capture
  |-- #13  POST /feedback            no blockers
  |-- #14  the feedback form         blocked by #13
  \-- #15  email the feedback out    blocked by #13
```

You file. Someone else builds. Apply no label.

## Before you start

Run `git remote -v`. No remote means no issue tracker. Say so and stop.

## 1. Gather context

Work from what the conversation already holds. If the user passes a reference - a path, an issue number, a URL - read its full body and its comments.

## 2. Read the code

If you have not read the code yet, read it. Use the project's domain vocabulary in every title and every body. Respect the ADRs in the area you touch.

Look for a prefactor that makes the change easy. "Make the change easy, then make the easy change."

## 3. Find the seam

Name the seam at which this work gets tested. Prefer a seam that already exists. Take the highest one you can. The fewer seams, the better. One is the target.

## 4. Cut the tickets

<vertical-slice-rules>

- Each ticket cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests). Vertical, never a horizontal slice of one layer.
- A finished ticket is demoable or verifiable on its own.
- Each ticket fits one fresh context window.
- The prefactor goes first.

</vertical-slice-rules>

Give each ticket its **blocking edges**: the tickets that must close before it can start. A ticket with no blockers can start now.

**A wide refactor is the exception to vertical slicing.** A wide refactor is one mechanical change - rename a column, retype a shared symbol - whose **blast radius** fans across the codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Do not force it into a tracer bullet. Sequence it as **expand-contract**. First expand: add the new form beside the old, so nothing breaks. Then migrate the call sites in batches sized by blast radius, per package or per directory, each batch its own ticket blocked by the expand. CI stays green batch to batch, because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even a batch cannot stay green alone, keep the sequence, but let the batches share an integration branch that they all block. Green is promised only at that final integrate-and-verify ticket.

## 5. Quiz the user

Show the seam. Then show the tickets as a numbered list. For each ticket: the title, what it delivers, and what blocks it.

Ask the user:

- Is the seam the one you expected?
- Is the granularity right - too coarse, too fine?
- Does each ticket depend only on what genuinely gates it?
- Should any tickets merge or split?

Iterate until the user approves. Only then do you file.

## 6. File

The parent first, so each ticket can name it. Then the tickets, in dependency order, blockers first.

```bash
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# the parent
p=$(gh issue create --title "<title>" --body-file <parent.md>); p=${p##*/}

# one ticket
c=$(gh issue create --title "<title>" --body-file <ticket.md>); c=${c##*/}

# make it a sub-issue of the parent
cid=$(gh api "repos/$repo/issues/$c" --jq .id)
gh api "repos/$repo/issues/$p/sub_issues" -F sub_issue_id="$cid"

# a blocking edge: ticket $c is blocked by ticket $b
bid=$(gh api "repos/$repo/issues/$b" --jq .id)
gh api "repos/$repo/issues/$c/dependencies/blocked_by" -F issue_id="$bid"
```

Both endpoints take the issue's `id`, never its number. `-F` sends it as a number; `-f` would send a string and fail.

When every ticket is filed, list them in the parent with `gh issue edit $p --body-file <parent.md>`.

## 7. Close the parent

GitHub does not close a parent when its last sub-issue closes. The agent that closes a sub-issue closes the parent.

After you close a ticket, read its `Parent:` line, then ask whether you closed the last one:

```bash
gh api "repos/$repo/issues/$p" --jq '.sub_issues_summary | .completed == .total'
```

`true` - you closed the last ticket. Run `gh issue close $p`.
`false` - tickets remain. Leave the parent open.

## 8. A finding, mid-flight

You report. Someone else investigates.

| Does someone have to build something? | Where it goes |
|---|---|
| Yes | a new sub-issue of the parent, with its blocking edges. File it by §6, then add it to the parent's Tickets list. |
| No | a comment on the parent. |

A decision, a constraint, a dead end, a thing you learned: comment. A behaviour someone must change: sub-issue.

Never edit a ticket someone is already building. Never close the parent early.

## Templates

Keep both bodies short. Evidence only from an investigation that already happened: the snippet and the file path.

<parent-template>

## Current behaviour

What happens today, in the fewest clear lines.

## Expected behaviour

What should happen instead, from the user's perspective.

## Tickets

- #13 <title>
- #14 <title>

</parent-template>

<ticket-template>

**Parent:** #<parent>

**Blocked by:** #<n>, #<n> - or "None. Can start now."

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective. Not a layer-by-layer implementation list.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

</ticket-template>

No file paths, no code snippets: they go stale fast. One exception - a prototype produced a snippet that carries a decision more precisely than prose can, such as a state machine, a reducer, a schema, or a type shape. Inline it, say it came from a prototype, and trim it to the decision. Not a working demo.
