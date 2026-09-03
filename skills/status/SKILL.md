---
name: status
description: Say where a project stands - what landed, what is open, the next ticket. Use when Vasu returns to a project, asks what is left, or what this was about.
---

# Status

Vasu holds three or four projects. He comes back to one after days, from another machine, and asks "what was this about" or "what is left". Eleven sessions opened that way.

```bash
${CLAUDE_SKILL_DIR}/scripts/status.sh [days]
```

It prints the trunk, what landed, the open PRs by Vasu, the open issues, the map issue, and the worktrees. Read the map's body for the decisions and the slice order, and the newest open PR for where the last session stopped.

Report in this order, and nothing else:

1. What this project is, in one line. The `## Product` section has it.
2. What landed since he was last here.
3. What is open: PRs waiting on him, PRs waiting on a fix, issues with no PR.
4. The next thing to do, named: a ticket number, a PR to merge, a decision to make.

A stale memory file loses to the repo. When a note and `git log` disagree, the log is right and the note gets rewritten.
