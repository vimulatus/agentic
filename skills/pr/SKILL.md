---
name: pr
description: Land a change as a PR or on the local trunk, and take the PR to ready. Use when you cut a branch, open a PR, or one you filed needs attention. Not for someone else's PR.
---

# PR

```
  branch ──> commits ──> open ──> watch ──> ready. Vasu merges.
                  │
                  └── no remote, or "no PR" ──> land on the trunk. Done.
```

Vasu merges, never you.

## 1 — The branch and the commits

Cut from the base as it is on the remote now, never from a local copy of it.

```bash
git fetch origin && git switch -c <type>/<slug> origin/<base>
```

Keep the history linear. Rebase onto the base, and land with a rebase or a squash.

| The commit | The rule |
|---|---|
| Shape | `type(scope): subject` |
| Types | feat, fix, docs, refactor, test, chore |
| Subject | Imperative, lowercase, no full stop |
| Size | One logical change. A 20-file commit is several |

```
Worked: you moved a helper and fixed the bug it hid.

  one commit  -> refactor(auth): extract token parsing   <- the move
  two commits -> fix(auth): reject a token with no exp   <- the bug
```

The hooks run. `--no-verify` is a red check you hid.

## 2 — Where it lands

| The repo | Land it |
|---|---|
| has a remote, and nobody said "no PR" | step 3 |
| has no remote, or Vasu said "local", "no PR", "test locally first" | rebase onto the trunk, run the gate, `git switch <trunk> && git merge --ff-only <branch>`. Report the sha. Done |

## 3 — Open it

```bash
git fetch origin && git rebase origin/<base>
gh pr create --base <base> --title "<title>" --body-file <file>
```

| The part | The rule |
|---|---|
| Title | Simple, plain words |
| Body, first | The problem, in the fewest clear lines |
| Body, then | How you solved it |
| `## Assumptions` | Every assumption you made where Vasu would have answered a question. One line each. No assumptions, no section |
| `Closes #N` | Every issue the PR resolves, not only the one you opened it for |
| Screenshots | A UI change carries them, before and after. `browser-evidence` takes them and hosts them |
| Size | What it touches and what can break, never a clock |

```
Clock: "a small change, about an hour"
Size:  "3 files, 1 call site. Risk: the session cookie name is
        read by the mobile client too, and I could not test it."
```

## 4 — Watch it

The PR is not done when it is open. It is done when it is ready: green, approved, no open thread, on top of the base.

Read [references/watch.md](references/watch.md) and the current client’s execution reference ([Claude Code](../orchestrate/references/claude.md) or [Codex](../orchestrate/references/codex.md)), then arm the watch. A worker that was told "open it and return" skips this: the caller watches.

## Blocked

Stop and report the wall, what you tried, and the one thing that unblocks you.

- a review asks for a product call, or a rewrite you disagree with
- a gate stays red after two honest fixes
- a rebase conflict where both sides are real work
- a check needs a secret or an environment you cannot reach
- a check has run past 30 minutes. Say so. Do not wait in silence
