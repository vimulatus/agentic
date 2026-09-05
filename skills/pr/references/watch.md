# Watch a PR to ready

```
  open ──> arm the watch ──> idle ──> event ──> act ──> push ──┐
                               ▲                              │
                               └──────── checks restart ──────┘
                               │
                   green + approved + 0 open threads + on top of base ──> ready. Stop.
```

Stay in the session until you report ready, or you are **blocked**. Stop the watch whenever this run ends, including blocked, merged, or closed outcomes.

## 1 — Arm the watch

Right after `gh pr create`, start the watch using the current client’s execution reference: [Claude Code](../../orchestrate/references/claude.md) or [Codex](../../orchestrate/references/codex.md). Read only that reference.

Resolve `<skill-dir>` below to the absolute directory containing the pr `SKILL.md`, one level above this reference; substitute the path before running commands.

```bash
"<skill-dir>/scripts/watch-pr.sh" <N> [owner/name]
```

One event per state you have not seen. It exits when the PR leaves `OPEN`.

A plain `comment` carries review as often as a `thread` does. Read every one.

## 2 — An event lands

| The event | Do |
|---|---|
| `base <sha>` | the base moved. `git fetch origin && git rebase origin/<base> && git push --force-with-lease`. Read the files you touched again: the code under you changed |
| `mergeable=CONFLICTING` | the same rebase. Both sides real work: blocked |
| `bad <check>` | step 3 |
| `thread <id>` | step 4 |
| `comment <url>` | step 4 |
| `comment <url>` whose body you wrote | nothing. It is your own reply coming back |
| `0 bad 0 pending`, `review=APPROVED`, no open thread, no `base` event pending | step 6 |
| `pr MERGED` | close the parent, step 7. Then stop |
| `pr CLOSED` | say so. Stop |

One wake is one batch. Push once, because every push restarts the checks, and every push runs step 5.

The `base` event is the one Vasu typed by hand eleven times. Every PR you filed this session rebases when it fires, not only the one whose watch woke you.

## 3 — A red check

Read the log first. The check name is not the failure.

```bash
run=$(sed -E 's#.*/runs/([0-9]+).*#\1#' <<< "<detailsUrl>")
gh run view "$run" --log-failed
```

Reproduce it locally and hand the failing command to `red-green`.

- Flaky, and the log shows no assertion: `gh run rerun <run> --failed`. Once. A second flake is a real bug.
- Red on the base branch too: not yours. Say so and carry on.

## 4 — Feedback

Reply to every one. Resolve only the threads you changed code for.

```
review thread   inline on a line   ->  reply on the thread, then resolve
review body     the summary        ->  reply as a plain comment
plain comment   on the PR itself   ->  reply as a plain comment
```

```bash
"<skill-dir>/scripts/thread.sh" reply <threadId> "<reply>"
"<skill-dir>/scripts/thread.sh" resolve <threadId>

gh pr comment <N> --body "<reply>"    # a review body, or a plain comment
```

The reply is one or two lines: what you did, and the commit sha.

A resolved thread tells the reviewer "handled", so a false one costs them a second read of the whole diff. A suggestion you did not take, and a question, stay open. The reviewer decides. State your reason once.

```
Worked: @sam writes "this map is rebuilt on every call".

  took it -> hoist to a module constant, push, reply
             "Hoisted to MIME_BY_EXT at module scope. a1b2c3d." -> resolve
  kept it -> reply "It reads a config that changes per request." -> leave open
```

## 5 — The evidence goes stale

A screenshot proves the diff that was there when you took it. Every push moves the diff.

After a push that changes what a user sees, retake the shot and swap the URL in the body.

```bash
# browser-evidence writes the new shot, then:
"<skill-dir>/scripts/refresh-shot.sh" <N> <task> "${TMPDIR:-/tmp}/vimulatus/<task>/after.png"
```

It uploads under the current sha and swaps the URL. The old URL keeps working.

Text-only pushes need none of this.

## 6 — Ready

Stop the watch using its retained process handle. Report the PR URL, every thread and comment with what you did and whether it is open, every check that went red and what fixed it, and the issues the PR closes. Then wait. Vasu merges.

## 7 — Merged

GitHub closes the tickets in `Closes #N`. It never closes their parent. You do.

```bash
"<skill-dir>/scripts/close-parent.sh" <N>    # for each ticket the PR closed
```

It closes the parent when its last ticket closed, and prints what it did.
