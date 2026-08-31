---
name: fs
description: Upload a file and get back a public URL on cdn.vmlts.com. Use when a screenshot, a recording or an image has to leave the repo - evidence on a PR, a shot in a user guide, a picture in a handout. Not for local files, which the file tools already reach.
---

# fs

```
.agent-evidence/<task>/after.png
        |
        +-- fs put --> https://cdn.vmlts.com/gh-ph/evidence/<task>/after.png
```

The command catalog is not in this file. It ships with the CLI:

```bash
fs        # no arguments, prints the usage
```

Everything below is the house layer on top of it.

## Upload

```bash
url=$(fs put .agent-evidence/login-fix/after.png --bucket evidence --key login-fix/after.png)
```

- `--bucket evidence` on every command. Nothing sets `FILESTORE_BUCKET`, so a command without it dies.
- `--key <task>/<name>.png` on every put. Without a key the object lands under a random prefix, and `fs ls` stops being readable.
- `<task>` is the slug the evidence directory already uses. `<name>` names the claim: `after.png`, not `screenshot-2.png`.
- The URL is the only thing on stdout, so `$(...)` captures it. The progress bar goes to stderr.

## The URL is the only credential

Anyone who holds the URL reads the file. There is no second check, and a PR body is as public as its repo.

- Never upload a shot that carries a token, a key, or a real customer's data.
- Crop to the claim. A full screen capture carries the tabs, the clock, and whatever else was open.

## Done

- [ ] Every put named a `--key`, and the key names its task.
- [ ] Every URL you embedded loads.
- [ ] Nothing you uploaded carries a secret.
