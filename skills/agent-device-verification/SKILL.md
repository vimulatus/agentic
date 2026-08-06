---
name: agent-device-verification
description: House methodology for verifying iOS/Android/macOS app UI and capturing before/after evidence with the agent-device CLI — worktree/tenant session isolation, restore-first in-app auth, snapshot/ref discipline, React Native introspection and render-profiling, and objective-defect scanning. Use when driving a device/simulator to verify a mobile change, capture UI evidence, or investigate current app UI. This is the house overlay, not the command manual — get the live catalog from `agent-device help workflow`.
license: MIT
metadata:
  author: vasu
  version: "1.0.0"
---

# agent-device verification

This skill is the **house way** of driving `agent-device` for verification and evidence. It does
**not** list commands — the catalog ships with the CLI and is version-matched:

```bash
agent-device help workflow        # the live core loop + command shapes
agent-device help debugging       # logs, network, alerts, traces
agent-device help dogfood         # exploratory bug-finding (investigate mode)
agent-device help react-native    # Metro / Fast Refresh / overlays
```

Load the relevant one first. Everything below is the opinionated layer on top.

## The loop (non-negotiable)

`devices/apps → open → snapshot -i → act → verify → close`. After any mutation (`press`/`fill`/
`type`/`scroll`/`back`), refs are **stale** — prefer a known selector (`press 'label="Send"'`) or
re-snapshot (`snapshot -i`, scoped with `-s` when a stable container exists). Coordinates are
**fallback-only** (document why). **Stateful commands run serially within one session**; only
read-only collection or *separate* sessions may run in parallel.

## Isolation — always

Use a **worktree-scoped session**; for genuinely parallel runs, isolate by tenant:

```bash
agent-device open <app-id> --session <worktree-slug> --platform <ios|android> --relaunch
# parallel-safe:
agent-device ... --session-isolation tenant --tenant <id>
```

Close only your own session/app — never end a shared session.

## Auth — restore-first

Two distinct things: **cloud-device auth** (`agent-device auth status|login` — access to remote
devices) is *not* in-app login. For the app's own login:

1. If `agent-creds/<platform>/` holds saved state, restore it and proceed.
2. Else, with credentials from the task, log in through the app UI, then persist the session state to
   `agent-creds/<platform>/`. Prefill sensitive values with `clipboard write` rather than echoing
   them; never put secrets on argv.
3. Else, for gated UI, stop and report "auth required".

`<platform>` ∈ `ios`, `android`, `macos`, …

## Evidence

Write to `agent-evidence/<run>/`. A claim **must name the expected text/selector**
(`wait text` / `is visible` / `get text` / `find`) — bare screenshots/snapshots are insufficient for
a named expectation.

- Stills: `screenshot agent-evidence/<run>/<name>.png` (`--overlay-refs` for tappable proof).
- Video: `record start … --hide-touches` (Android caps at 180s → returns MP4 chunks).
- Before/after: `diff snapshot` / `diff screenshot`.

Determinism analogs (no JS injection on native): `settings animations off` before capture;
`trigger-app-event` to drive the app into a known state.

## React Native introspection (when the app is RN)

The accessibility tree can't show components/props/state/renders — React DevTools can:

```bash
agent-device react-devtools status && agent-device react-devtools wait --connected
agent-device react-devtools get tree --depth 3
agent-device react-devtools find <Component>
agent-device react-devtools get component @c5     # current props/state/hooks
# render-perf, narrow window:
agent-device react-devtools profile start         # ... drive the repro ...
agent-device react-devtools profile stop
agent-device react-devtools profile slow --limit 5
agent-device react-devtools profile rerenders --limit 5
# before/after perf evidence (pairs with the git before/after flow):
agent-device react-devtools profile export before.json   # ... apply change ...
agent-device react-devtools profile export after.json
agent-device react-devtools profile diff before.json after.json --limit 10
```

`@c` refs reset on reload/remount — `wait --connected` and re-inspect after a reload. Keep the
profile window narrow; unrelated navigation makes render data noisy. For JS-only changes use
`metro reload` (never a bare `reload`); `open --relaunch` resets native state. Clear RN overlays with
`react-native dismiss-overlay`.

## Objective defect scan (every run)

Flag, with evidence: clipping / overflow, overlapping elements, blank or AX-unavailable screen,
broken images, safe-area/notch breakage, frozen frames (`perf frames --json`).

## Device hazards to respect

Refs stale after mutation; coordinates fallback-only; `fill` replaces / `type` appends and empty
`fill ""` is **not** a clear (use a visible clear control or report the gap); Android IME/handwriting
can capture input — don't loop `fill`/`type`, fix the IME first; sparse/AX-unavailable screens mean
refs are unreliable — use a plain `screenshot` and navigate by coordinates, then retry `snapshot -i`.
