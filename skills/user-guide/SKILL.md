---
name: user-guide
description: Write a guide for the people who use the app, and host it where they can reach it. Use when the user asks for a user guide, a how-to, onboarding steps, or help docs for a feature. Not for a README or API docs, which serve developers.
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

- Second person, present tense, imperative: "Open **Settings**".
- The word on the screen, never the word in the schema. `tenant` in the DB is "workspace" to the reader.
- Cut the reason a feature exists unless it changes what the reader clicks.

## Done

- Every label in the guide matches the running app.
- A reader who has never opened the app finishes the task without you.
- The page renders at its real route. Give the URL.
