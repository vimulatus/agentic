---
name: bug-hunt
description: Explore a running web app for bugs and UX issues with a fleet of persona agents, and report each finding with a repro, shots and a recording. Use when Vasu says bug hunt, dogfood, QA or find issues. Not for proving one change, which browser-evidence owns.
---

# Bug hunt

Personas use the app as its users would, and they report what breaks, what drags and what hides. Someone else investigates and fixes.

Resolve `<skill-dir>` from this skill's loaded `SKILL.md` path. `<evidence-dir>` is `<skill-dir>/../browser-evidence`, the skill that owns the browser, capture, hosting and embedding. Workers do not inherit either; every brief receives both as absolute paths, and a worker reads `<evidence-dir>/SKILL.md` itself.

```
scope ──┬── environment ──┐
        │                 ├──> one hunter per persona ──> dedupe + report ──> show ──> file, on Vasu's word
        └── personas ─────┘
```

| Stage | Worker | Model | Brief |
|---|---|---|---|
| environment | one | opus | [references/environment.md](references/environment.md) |
| personas | one, in parallel with environment | opus | [references/personas.md](references/personas.md) |
| hunt | one per persona, in parallel | sonnet | [references/hunter.md](references/hunter.md) |
| dedupe | one, after every hunter returns | sonnet | [references/dedupe.md](references/dedupe.md) |

Run the stages with the current client's reference: [Claude Code](references/claude.md) runs the workflow script, [Codex](references/codex.md) runs the same stages as `orchestrate` workers. Each worker reads its own brief from `<skill-dir>/references/`; the brief is the contract, and the client reference only carries the run.

## Scope

Vasu names the app, and sometimes an area. Read the project's `## Product` section for who the app serves; the personas worker turns that into the people who hunt. No area named: the core workflows first, the edges after.

The **task** is a kebab-case slug for this hunt, one per run: `bug-hunt-<app>-<date>`. Everything lands under `${TMPDIR:-/tmp}/vimulatus/<task>/`, nothing in the repo.

Findings come from the browser: what rendered, how long it took, what the console said, what a request returned. No worker reads the app's source. The report describes behaviour, and the investigator owns the cause.

## What counts as a bug

A bug is a bug. There is no severity; the class tells the investigator where to look.

| Class | It means |
|---|---|
| functional | the app does the wrong thing, errors, or loses data |
| performance | it works, and the user waits too long: no feedback within 1 s of an action, or a page or action past 3 s |
| navigation | it works, and the user cannot find it: the goal takes more than 3 hops from where the persona starts, a dead end, or no way back |
| visual | clipped, misaligned, overlapping or unreadable on the screen |
| content | a typo, a wrong label, a stale or empty message where one is due |

Depth over count. Five findings a reader can replay beat twenty a reader has to trust.

## The report

The dedupe worker writes `${TMPDIR:-/tmp}/vimulatus/<task>/report.md`: a findings table, then one block per finding. Two personas hitting the same behaviour is one finding that names both personas.

Each finding is one issue body, in the shape `to-tickets` files:

```markdown
## <verb phrase in the user's words, one line>

**Class:** functional | performance | navigation | visual | content
**Where:** <URL>
**Seen by:** <persona>, <persona>

### Current behaviour

What happens, in the fewest clear lines. Quote the console line, the failed request, or the measured wait when there is one.

### Expected behaviour

What the user should see instead.

### Repro

1. Open <URL>.
2. Type `acme` in the search field and press Enter.

   ![the results list stays empty](<url>)

3. **Observe:** the list is empty and the console shows `TypeError: results is undefined`.

   ![the console shows the TypeError](<url>)

![the whole repro](<url of the GIF>)
[Recording](<url of the .webm>)
```

The title names the behaviour, not the guess at the cause: "Search shows no results for a two-word query", not "Search query is not split". Real values in the steps: the text typed, the button clicked, the row that broke, the seconds waited.

## Done

Every hunter closes its own browser session. Then:

1. Stop the server only when the environment worker started it; its return names the stop command. A listener that was there before the run is Vasu's.
2. `"<evidence-dir>/scripts/check-embeds.sh" <report.md>` passes.
3. Show Vasu the path of the report and the findings table: title, class, where, seen by.

Vasu says file: `to-tickets`, one issue per finding. Search first and file, and skip its read-the-code step: the report is the evidence. The `##` line is the issue title and leaves the body; the rest of the block is the body.

- [ ] Every finding reproduced twice, and its evidence hosted and embedded.
- [ ] Console and errors captured on every functional finding; the wait measured on every performance finding.
- [ ] The findings table matches the findings.
- [ ] Nothing in the report came from the app's source.
- [ ] Every browser session this run opened is closed, and every server it started is stopped.
