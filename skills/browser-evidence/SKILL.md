---
name: browser-evidence
description: Drive a browser, capture evidence, and host the shots. Use when verifying a web UI change in the running app, or a screenshot goes into a PR. Not for the agent-browser command reference.
---

# Browser evidence

`agent-browser` is the browser. Run it with no arguments to read its docs.

```
server ──> session ──> auth ──> drive ──> evidence ──> host ──> close your session
```

The command catalog is not in this file. It ships with the CLI and it is version-matched:

```bash
agent-browser skills get core     # load this first
```

Everything below is the house layer on top of it.

## The server

Probe the port before you start anything.

```bash
lsof -nP -iTCP:<port> -sTCP:LISTEN
```

| The port | Do |
|---|---|
| has a listener | it is Vasu's. Drive it. Never kill it, never start a second one on another port |
| is free | start your own, to a log file, and stop it when you are done |

Vasu on a second Storybook: "Kill it and run ours. 6006 is yours only, I started the server." Four sessions.

## One session per task

- Pass `--session <task>` on every command. `<task>` is a kebab-case slug for the work, one per worktree.
- Close your own session. `close --all` kills the browser of every parallel project.

## Auth

- State lives at `~/.agent-auth/<host>.json`. Outside the repo, so a worktree and a second project find it too.
- **Restore first.** The file exists, so pass `--state` and skip the login.
- No file: log in, then `state save ~/.agent-auth/<host>.json`.
- Passwords reach the CLI through the vault (`auth save` / `auth login`) or through `--password-stdin`. Shell history is a leak.
- A gated page, no state file and no credentials: stop and report `auth required`.

## Evidence

Nothing lands in the repo. Everything lands in `${TMPDIR:-/tmp}/vimulatus/<task>/`: screenshots, recordings, console dumps.

Name each file for the claim it supports: `login-shows-error.png`, not `screenshot-3.png`.

## Host

A shot that leaves the machine, for a PR body or a report, gets a URL. The URL is the evidence.

```bash
url=$(${CLAUDE_SKILL_DIR}/scripts/host.sh <task> "${TMPDIR:-/tmp}/vimulatus/<task>/after.png")
```

Anyone who holds the URL reads the file, and a PR body is as public as its repo. Crop to the claim: a full screen carries the tabs, the clock, and whatever else was open. Never a token, a key, or a real customer's data.

## Proof

- A screenshot is not proof. Name the expected text or selector: `get text`, `is visible`, `wait --text`.
- Capture `console` and `errors` on every functional check. A console error or a failed request is a **fail**.
- Report the claim, the command that proved it, and the URL or the path of the file.

## Done

- [ ] Every claim names the text or the selector that proved it.
- [ ] Console and errors are captured, and they are clean.
- [ ] Every shot a reader needs is hosted, and its URL loads.
- [ ] Your session is closed. Every other session still runs. Your server, if you started one, is stopped.
