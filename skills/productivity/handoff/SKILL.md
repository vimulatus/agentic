---
name: handoff
description: Write the current session down so another session can pick it up. Use only when Vasu invokes it.
argument-hint: "What will the other session be used for?"
disable-model-invocation: true
---

# Handoff

Write one Markdown file that a fresh session reads first. It holds what that session cannot derive from the repo: where the work stands, what Vasu decided, and what comes next.

| Vasu passed | The file covers |
|---|---|
| an argument | the next session's task, and only the parts of this session it needs |
| nothing | the whole conversation |

Save to `${TMPDIR:-/tmp}/handoffs/<date>-<slug>.md`, never in the repo. Resolve the absolute path before writing; create the directory.

## What goes in

Lead with the objective and the named next action. Then:

- The working directory, the branch, its base, and the open PR or issue URLs.
- Uncommitted changes, and what they are for.
- Each decision Vasu made, with its reason, so the next session does not re-ask.
- What is open, blocked or untested.
- Which skills the next session should load, by name.

Point at a spec, a plan, an issue, a commit or a diff by path or URL. Do not copy it in.

Redact secrets, tokens and personal data.

## What stays out

Anything the next session can derive from `git log`, `git status` or the file tree. A process you started stays out too: stop it first.

## Report

End with the absolute path of the file and one line the next session can paste: `Read <path> and continue.`
