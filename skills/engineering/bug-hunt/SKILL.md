---
name: bug-hunt
description: Explore a running web app for bugs and UX issues, and report each with a repro, shots and a recording. Use when Vasu says bug hunt, dogfood, QA or find issues. Not for proving one change, which browser-evidence owns.
---

# Bug hunt

You use the app as its user would, and you report what breaks. Someone else investigates and fixes.

```
scope ──> browser-evidence setup ──> explore + document, one pass ──> report ──> file, on Vasu's word
```

`browser-evidence` owns the server, the session, auth, capture, hosting and embedding. Load it first. Everything below is the hunt on top of it.

## Scope

Vasu names the app, and sometimes an area. Read the project's `## Product` section for who the user is, then be that user. No area named: the core workflows first, the edges after.

Findings come from the browser: what rendered, what the console said, what a request returned. Do not read the app's source while you explore. The report describes behaviour, and the investigator owns the cause.

## Explore and document

One pass. When something is wrong, stop exploring and document it before you move on. A finding that waits for the end of the session is a finding that is lost when the session is.

| Before you capture | Do |
|---|---|
| it happened once | reproduce it once more. A one-off is not a finding |
| it involves an action, timing or a state change | record the repro, per `browser-evidence`, with a screenshot at each step |
| it is visible on load: a typo, clipped text, a misaligned row | one screenshot, cropped to the element. No recording |
| the console or a request failed | capture `console` and `errors`, and quote the line |

Depth over count. Five findings a reader can replay beat twenty a reader has to trust.

| Severity | It means |
|---|---|
| critical | blocks a core workflow, loses data, or crashes the app |
| high | a feature is unusable, and there is no workaround |
| medium | it works, with a workaround or a visible problem |
| low | cosmetic |

## The report

Write to `${TMPDIR:-/tmp}/vimulatus/<task>/report.md`, one finding at a time as you go. Host every shot and recording, and embed them by the `browser-evidence` Embed table, so the report reads the same on GitHub as on disk.

Each finding is one issue body, in the shape `to-tickets` files:

```markdown
## <verb phrase in the user's words, one line>

**Severity:** critical | high | medium | low
**Where:** <URL>

### Current behaviour

What happens, in the fewest clear lines. Quote the console line or the failed request when there is one.

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

The title names the behaviour, not the guess at the cause: "Search shows no results for a two-word query", not "Search query is not split". Real values in the steps: the text typed, the button clicked, the row that broke.

Open the report with a table of the findings: title, severity, where. Fill it as you go; the counts must match the findings when you stop.

## Done

Close your session per `browser-evidence`. Then report to Vasu: the path of the report, the findings table, and the one finding that matters most.

Vasu says file: `to-tickets`, one issue per finding. Search first and file, and skip its read-the-code step: the report is the evidence. The `##` line is the issue title and leaves the body; the rest of the block is the body. Add the repo's severity label when it has one.

- [ ] Every finding reproduced twice, and its evidence hosted and embedded.
- [ ] Console and errors captured on every functional finding.
- [ ] The findings table matches the findings.
- [ ] Nothing in the report came from the app's source.
