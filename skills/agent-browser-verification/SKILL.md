---
name: agent-browser-verification
description: House methodology for verifying web UI and capturing before/after evidence with the agent-browser CLI — isolated sessions, restore-first auth, deterministic baselines via init-scripts, React introspection, and objective-defect scanning. Use when driving a browser to verify a frontend change, capture UI evidence, or investigate current web UI. This is the house overlay, not the command manual — get the live catalog from `agent-browser skills get core`.
license: MIT
metadata:
  author: vasu
  version: "1.0.0"
---

# agent-browser verification

This skill is the **house way** of driving `agent-browser` for verification and evidence. It does
**not** list commands — the catalog ships with the CLI and is always version-matched:

```bash
agent-browser skills get core          # the live command catalog + core loop
agent-browser skills get core --full   # full reference + templates
agent-browser skills get dogfood       # exploratory bug-finding (use in investigate mode)
```

Load that first. Everything below is the opinionated layer on top.

## The loop (non-negotiable)

`open → snapshot -i → act on @refs → re-snapshot → verify`. Refs go **stale** the moment the page
changes — re-snapshot after every navigating click, submit, or dynamic re-render. Wait on a concrete
signal (`wait @ref` / `wait --text` / `wait --url` / `wait --load networkidle`), never a bare
`wait 2000`.

## Isolation — always

Run in your own **named session** (one per worktree) so parallel agents never collide:

```bash
agent-browser --session <worktree-slug> open ...
```

Close only your session when done. **Never `close --all`** — it kills every peer agent's browser.

## Auth — restore-first

1. If `agent-creds/browser/<host>.json` exists, restore it (`state restore` / load before first
   navigation) and proceed.
2. Else, with credentials from the task, log in — feed secrets via `--password-stdin` or the auth
   vault (`auth save`/`auth login`), **never on argv** (shell history is a leak). Then persist:
   `state save agent-creds/browser/<host>.json`.
3. Else, for gated UI, stop and report "auth required".

## Evidence

Write to `agent-evidence/<run>/`. A functional claim **must name the expected text/selector**
(`get text` / `is visible` / `wait --text` / `find`) — a screenshot alone is not proof. On **every**
functional check also capture `console` and `errors`; a console error or failed request is a FAIL.

- Stills: `screenshot agent-evidence/<run>/<name>.png`. Flows: `record start … / record stop`.
- Before/after: `diff screenshot --baseline …` (capture the baseline deterministically — see below).

## Deterministic baselines & init-scripts

`open --init-script <path>` injects JS **before page JS on every document** (repeatable;
`--enable react-devtools` is itself a built-in init-script). Use this for clean, meaningful evidence:

- **Baseline/diff shots:** launch with the house determinism script so `diff screenshot` reflects
  real change, not clock churn or mid-animation frames:

  ```bash
  agent-browser --session <slug> open --init-script ~/.claude/skills/agent-browser-verification/scripts/deterministic.js <url>
  ```

  It freezes `Date`/`Math.random`, kills CSS animations/transitions, forces reduced-motion, and
  records page errors from byte 0 (`window.__AGENT_ERRORS__`).
- **Then run a *separate* normal pass** (no determinism script) to verify animations/transitions
  actually fire — don't suppress the very thing you're checking.
- **Forcing states:** seed `localStorage`/feature-flags via a small `--init-script`, and/or stub the
  network (`network route <url> --abort | --body <json>`), to actually reach and verify
  loading / error / empty states instead of hoping they appear.

## React introspection (when the target is React)

Launch with the hook (must precede page JS — your fresh session already does), then inspect:

```bash
agent-browser --session <slug> open --enable react-devtools <url>
agent-browser react tree                 # component tree with fiber ids
agent-browser react inspect <fiberId>    # props, hooks, state, source
agent-browser react renders start        # ... drive the interaction ...
agent-browser react renders stop --json  # render commits — catch needless rerenders
agent-browser react suspense --only-dynamic
agent-browser vitals --json              # Core Web Vitals + hydration timing
```

Use these to confirm the *right* components rendered with the expected props/state and to catch
rerender regressions — don't rely on the accessibility snapshot alone for React-specific claims.

## Objective defect scan (every run)

Flag, with evidence: horizontal overflow / clipping, overlapping elements, blank render, console
errors or failed network requests, broken images, illegible (sub-AA) contrast. Check responsive at
~320px and wide.

## When to load another skill

Exploratory investigation → `agent-browser skills get dogfood`. Electron/desktop, Slack, or cloud
browsers → their named skills. Don't reinvent what a shipped skill already covers.
