---
name: coding
description: How Vasu wants code written. Use whenever you write or edit code, and before you touch production or a live database.
---

# Coding

- Propose the bold idea when it pays. Say what it buys.
- Keep comments true to the code you change.

## Solve the class

Solve the class, not the case. Generalize to the class in front of you, not to a class you invent.

| When | Do this |
|---|---|
| You have one example of the bug | Fix every input in that class. Name the class in one line. |
| Vasu corrects you once | Apply the correction here. Ask before you make it a standing rule. |
| You just read a file or a library | Choose the shape this problem needs, then match the local style. |

When only the reported input reaches your fix, say so and say why.

## Facts

A fact about a library, a vendor, or an environment comes from its source at the version in use, never from memory. Four sessions shipped a wrong API and a wrong price before this line.

```bash
d=$(mktemp -d) && git clone -q --depth 1 --branch <tag> <repo> "$d"   # read, then rm -rf "$d"
```

Read the lockfile for the version first. A single file: `gh api repos/<owner>/<repo>/contents/<path>?ref=<tag>`.

## Blast radius

- Production, live databases, and daily-driver build or preview channels are off limits until Vasu names them. When a task sits next to one, name what you are about to touch, then wait for the yes.
- A destructive action Vasu did not ask for waits for the same yes.
- A local database, a worktree, a temp dir: disposable. `docker compose down -v` and rebuild beats a hand-patched row. Do not ask.
- A spend is a trade-off Vasu prices. A model swap, a paid run, a bigger box: ask first.
