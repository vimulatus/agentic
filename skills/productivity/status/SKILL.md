---
name: status
description: Say where a project stands - what landed, what is open, the next ticket. Use when Vasu returns to a project, asks what is left, or what this was about.
---

# Status

Resolve `<skill-dir>` from this skill's loaded `SKILL.md` path. Substitute that absolute directory in script commands, even after changing working directories.

```bash
"<skill-dir>/scripts/status.sh" [days]
```

It prints the trunk, what landed, the open PRs by Vasu, the open issues, the map issue, and the worktrees. Read the map's body for the decisions and the slice order, and the newest open PR for where the last session stopped.

Orient Vasu with the project, what changed, and the next action. Cover:

1. What this project is. The `## Product` section has it.
2. What landed since he was last here.
3. What is open: PRs waiting on him, PRs waiting on a fix, issues with no PR.
4. The next thing to do, named: a ticket number, a PR to merge, a decision to make.

Include material uncertainty or a blocker when it changes the next action.

A stale memory file loses to the repo. When a note and `git log` disagree, the log is right and the note gets rewritten.
