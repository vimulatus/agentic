---
name: user-guide
description: Write and host a guide for the people who use the app. Use when Vasu asks for a user guide, a how-to, or help docs. Not for developer docs.
---

# User guide

One guide, one task. Write for the person on the screen.

## Pick the target

| The project holds | Write | The user reaches it at |
|---|---|---|
| a docs site: `docs/`, `mkdocs.yml`, `docusaurus.config.*`, `*.mdx` | `docs/guides/<task>.md` | the docs site |
| a served dir: `public/`, `static/` | `public/guides/<task>.html`, self-contained | `/guides/<task>` |
| neither | `guides/<task>.html`, self-contained | an Artifact URL |

Name the target and the route before you write. Assets sit beside the page, in `<task>/`.

An Artifact carries no sibling files. On that row, embed every shot and every video as a `data:` URI, and keep the page under 16 MB.

## Walk the flow first

Never write a step you have not seen. Start the app with the `run` skill, then drive `agent-browser`.

```
open the app  ->  walk the task once  ->  snapshot each screen
                                              |
                        labels verbatim <------+------> shots and video
```

- Copy every label from `agent-browser snapshot`. A paraphrased label is a wrong label.
- Screenshot where the reader can take the wrong turn, not once per step.
- When a label contradicts the request, the app wins. Say so in one line.

### Video

Optional. One task per video, and short.

```bash
agent-browser record start ./guides/<task>/demo.webm <url>
# walk the task, one pass, no detours
agent-browser record stop
```

- Seed the state before you start recording. The reader watches the task, not the login.
- Slow the mouse only where the click target is small.
- Embed muted, looping, with controls. The guide must read fine with the video blocked.

## Shape

```
+------------------------------------------+
|  What you get, in one line               |
|  Before you start: 2 items at most       |
+------------------------------------------+
|  1. Click Billing in the left menu.      |  <- one action
|     [shot]  The plan list opens.         |  <- the result, when it surprises
|  2. ...                                  |
+------------------------------------------+
|  Done: what the screen shows now         |
|  If it fails: the message, then the fix  |
+------------------------------------------+
```

- One action per step. "Click **Save**", not "Configure the plan and save".
- Name what the reader sees: the button label, the page title, the tab.
- Prerequisites are things the reader must already hold. Cut the rest.
- Failures last, keyed by the message the reader gets.

## Copy

The `copy` skill owns every string the reader sees. Load it before you write the steps.

- Name the label the app shows, verbatim from `agent-browser snapshot`.

## Done

- Every label in the guide matches the running app.
- A reader who has never opened the app finishes the task without you.
- The page renders at its real route. Give the URL.
