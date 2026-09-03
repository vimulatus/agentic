---
name: browser-evidence
description: Drive a browser and capture evidence. Use when verifying a web UI change in the running app. Not for the agent-browser command reference.
---

# Browser evidence

`agent-browser` is the browser. Run it with no arguments to read its docs.

```
gitignore ──> session ──> auth ──> drive ──> evidence ──> close your session
```

The command catalog is not in this file. It ships with the CLI and it is version-matched:

```bash
agent-browser skills get core     # load this first
```

Everything below is the house layer on top of it.

## Before the browser opens

Both directories stay out of git. Run this first, once per task:

```bash
${CLAUDE_SKILL_DIR}/scripts/gitignore-agent-dirs.sh
```

## One session per task

- Pass `--session <task>` on every command. `<task>` is a kebab-case slug for the work, one per worktree.
- Close your own session. `close --all` kills the browser of every parallel project.

## Auth

- State lives at `<root>/.agent-auth/<host>.json`.
- **Restore first.** The file exists, so pass `--state` and skip the login.
- No file: log in, then `state save <root>/.agent-auth/<host>.json`.
- Passwords reach the CLI through the vault (`auth save` / `auth login`) or through `--password-stdin`. Shell history is a leak.
- A gated page, no state file and no credentials: stop and report `auth required`.
- These files hold live session cookies. They stay out of every commit.

## Evidence

- Everything lands in `<root>/.agent-evidence/<task>/` — screenshots, recordings, console dumps.
- Name each file for the claim it supports: `login-shows-error.png`, not `screenshot-3.png`.

## Proof

- A screenshot is not proof. Name the expected text or selector: `get text`, `is visible`, `wait --text`.
- Capture `console` and `errors` on every functional check. A console error or a failed request is a **fail**.
- Report the claim, the command that proved it, and the path to the file.

## Done

- [ ] `.agent-auth/` and `.agent-evidence/` are in `.gitignore`.
- [ ] Every claim names the text or the selector that proved it.
- [ ] Console and errors are captured, and they are clean.
- [ ] Your session is closed. Every other session still runs.
