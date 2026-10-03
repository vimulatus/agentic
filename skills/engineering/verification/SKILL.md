---
name: verification
description: Write a project's verify-<app> skill - how to launch the app, check it is healthy, drive each feature the way a user does, capture evidence and clean up. Use when a project has no scripted way to prove its UI, CLI or service works, or Vasu asks for a verification or control skill. Not for proving one change, which browser-evidence owns.
---

# Verification

You write a skill for the next agent. It reads the skill cold, mid-task, and has never seen the app. The skill is the project's recipe to prove behavior: launch, doctor, drive, evidence, cleanup, and a feature map.

```
read the repo ──> fix a broken start ──> write verify-<app> ──> seed the feature map ──> run it once ──> record it in Ship
```

## Read the repo, not Vasu

Answer from the code. Ask Vasu only for what you cannot observe, such as a credential or a paid account.

| Question | Where the answer is |
|---|---|
| Surface: what does a user touch? A web UI, a CLI or TUI, a desktop app, an API | routes, `bin` entries, menus, the README |
| Run: the start command, the port, the env, seed data, auth | package scripts, Makefile, compose file, the Ship section's Run line |
| Drive: how an agent acts on it | existing e2e specs, PTY helpers, endpoints. Then the driver for the surface, below |
| Observe: what proves a result | screenshots, transcripts, response bodies, logs, exit codes, database rows |
| Isolate: can two instances run side by side | ports, data directories, profiles |

A repo with several surfaces: write the recipe for the primary one, and list the rest in the map README.

| Surface | Driver |
|---|---|
| Web UI, Electron | `browser-evidence` |
| CLI, TUI | one tmux session per drive: `tmux new -d -s <task>`, `send-keys`, `capture-pane -p` |
| Service, API | `curl` against the running port |

If the checkout does not build or start, fix that first, or report the exact failure. A skill written against a broken start teaches wrong steps.

## Write the skill

Write `.agents/skills/verify-<app>/SKILL.md` in the project, and link `.claude/skills/verify-<app>` to it with `ln -s ../../.agents/skills/verify-<app>`. Both clients then read one copy. The frontmatter carries `name: verify-<app>` and a description that names the app, its surface, and the words launch, run and verify, so the agent finds it when it has to run the app.

Every section comes from what you found. No placeholder survives.

| Section | It holds |
|---|---|
| Launch | The start command, the ready signal (a log line, a port that answers, a prompt), and the stop command. Probe the port first. A listener that Doctor confirms is this app is Vasu's: drive it, never stop it. A listener from another app: start on a free port. A short-lived CLI has no server: build it once, then give each drive its own tmux session |
| Doctor | One read-only check that the instance is worth driving: process up, the right build, port answers, auth valid. Run it before the first drive and after any surprise |
| Drive | The driver with this repo's real handles: ARIA names, data attributes, prompt strings, routes. Never coordinates or tab order |
| Evidence | What proves each claim, and where it goes: `${TMPDIR:-/tmp}/vimulatus/<task>/`. Drive the user's path, not an internal setter or a test-only endpoint. Capture the action and the resulting state. Check the side effect (a row, a file, a message) as well as the screen. A dry-run mode proves only what you saw it skip |
| Cleanup | Stop what this run started, by PID or session name, never by process name. Remove scratch data. Keep the evidence |
| Helpers | Each script under `scripts/`, executable, with its call shown in the body |

## Seed the feature map

Write `features/README.md` and one file per user-facing feature. Start with the top 3 to 5, from routes, commands, menus or docs.

The README holds what every recipe shares: the baseline state, the driving conventions, what counts as proof, and an index with one line per feature. List the surfaces the recipe does not drive.

Each feature file has an H1, one paragraph on what the user sees, then four H2s in this order:

```markdown
# Create a note

A user saves a titled note from the browser or the CLI, and finds it again in the list.

## Sub-features

- `create-save` saves a title and a body.
- `create-cli` creates the same note from the terminal.

## How to get to it (user POV)

- The `New note` button in the toolbar.
- `notes create --title <title> --body <body>` in a terminal.

## Driving it with agent-browser

Preconditions: the app answers on :4173. No note is titled `Release checklist`.

- **Save.** Click the button `New note`, fill `Title`, click `Save note`. The heading reads `Release checklist`.
- **Persist.** Open `All notes`, then the note. Both values show.

## Gotchas

- The `Note saved` toast is not proof. Open the note again.
```

A proof that drives one entry point is incomplete when the map lists more.

## Run it once

Follow the new skill's own words from end to end: launch, doctor, drive one mapped feature, capture evidence, clean up. After cleanup, confirm the evidence is still at its path. Fix what fails, and run the cleanup after each failed attempt. A skill that never ran is a draft.

## Record it

Load `product-context`, and point the Ship section's Gate line at `verify-<app>` for a change a user can see.

## Done

- [ ] `verify-<app>` is in `.agents/skills/`, and the `.claude/skills/` link resolves.
- [ ] One feature ran from end to end by the skill's own words. The report gives the evidence path.
- [ ] Nothing that this run started still runs.
