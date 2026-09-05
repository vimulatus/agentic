---
name: to-tickets
description: File one issue, or a parent with a sub-issue per ticket and blocking edges. Use when a bug, a finding, a plan or a spec is ready to file. Not for building it.
---

# To tickets

Resolve `<skill-dir>` from this skill's loaded `SKILL.md` path. Substitute that absolute directory in script commands, even after changing working directories.

You file. Someone else builds.

```
one issue      a bug, a chore, a finding        -> §1, §2, §5
a parent       a plan or a spec with tickets    -> §1 to §6

parent #12  Feedback capture
  |-- #13  POST /feedback            no blockers
  |-- #14  the feedback form         blocked by #13
  \-- #15  email the feedback out    blocked by #13
```

A **ticket** is one sub-issue: a narrow, complete path through every layer, demoable on its own, sized for one context window.

## Before you start

`git remote -v`. No remote means no tracker. Say so and stop.

## 1 — Search first

```bash
gh issue list --search "<two or three words from the title>" --state all --limit 20
```

An open issue that already names the behaviour: comment on it, do not file. Vasu asked "why did you create 1243 when 1114 already exists" once. Once is enough.

## 2 — Read the code

Read the code the work touches, and the project's own words for it. Every title and body uses those words.

For a plan, look for the **prefactor**: the change that makes the change easy. It goes first.

## 3 — Cut the tickets

- Each ticket cuts a narrow but complete path through every layer: schema, API, UI, tests. Never one layer.
- A finished ticket is demoable or verifiable on its own.
- Each ticket fits one fresh context window.
- The prefactor goes first.

Give each ticket its **blocking edges**: the tickets that must close before it starts. A ticket with no blockers can start now.

**A wide refactor is the exception.** One mechanical change whose blast radius fans across the codebase, so no ticket lands green alone. Sequence it as **expand-contract**:

| Step | The ticket | Blocked by |
|---|---|---|
| Expand | Add the new form beside the old. Nothing breaks. | none |
| Migrate | Move the call sites in batches: per package, per directory. One ticket per batch. | Expand |
| Contract | Delete the old form once no caller remains. | every Migrate batch |

## 4 — One round

Show the tickets as a numbered list: title, what it delivers, what blocks it. Under it, the calls you made and would take a correction on: the granularity, an edge, a merge or a split. One round, recommended answers, Vasu answers by exception. `grilling` owns the form.

Vasu away: file as recommended, and say so in the parent.

## 5 — File

Read the project's labels first. A project that labels by area or by kind gets its labels. No convention, no label.

```bash
gh label list --limit 60 --json name --jq '.[].name'
```

The parent first, so each ticket can name it. Then the tickets, blockers first.

```bash
p=$(gh issue create --title "<title>" --body-file <parent.md>); p=${p##*/}
c=$(gh issue create --title "<title>" --body-file <ticket.md>); c=${c##*/}

"<skill-dir>/scripts/link.sh" sub   "$p" "$c"    # $c is a sub-issue of $p
"<skill-dir>/scripts/link.sh" block "$c" "$b"    # $c is blocked by $b
```

When every ticket is filed, list them in the parent with `gh issue edit $p --body-file <parent.md>`.

A parent closes when its last ticket closes. GitHub does not do that. The `pr` skill does, at merge.

## 6 — A finding, mid-flight

| Does someone have to build something? | Where it goes |
|---|---|
| Yes | a new sub-issue of the parent, with its blocking edges. File it by §5, then add it to the parent's list. |
| No | a comment on the parent. |

A decision, a constraint, a dead end: comment. A behaviour someone must change: sub-issue.

Never edit a ticket someone is already building. Never close the parent early.

## Bodies

Current behaviour, then expected behaviour. Plain words for a reader who was not in the room. A subtle behaviour gets a worked example with real values. Evidence only from an investigation that already happened: the snippet and the file path.

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

The end-to-end behaviour this ticket makes work, from the user's perspective. Not a layer-by-layer list.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

</ticket-template>

No file paths, no code snippets in a ticket: they go stale. One exception: a prototype produced a shape that carries a decision better than prose, a state machine, a schema, a type. Inline it, trimmed to the decision, and say where it came from.
