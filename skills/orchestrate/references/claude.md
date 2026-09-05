# Claude Code execution

Use the tools actually available in this session. These mechanics apply to Claude Code; workflow outcomes stay in the calling skill.

## Workers

Use `Agent` with the named role when installed: `dev`, `reviewer`, or `researcher`. Their task instructions live in `../../../agents/<role>.md`, relative to this reference. If a named role is unavailable, read its task instructions and include them in the worker brief. If delegation is unavailable, perform that role locally, one task at a time.

Supply a self-contained brief; workers do not inherit the parent conversation. Set `isolation: "worktree"` for workers that write code or check out a PR. Record the worktree and branch returned by the tool. Separate instruction-only file ownership may share a tree.

Cap the fleet by the available agent capacity as well as the calling skill’s machine limit.

## Watches

When `Monitor` is available, run the calling skill’s watch command with `persistent: true`. Retain its task ID, consume emitted events, and stop it with `TaskStop` when the owning run ends.

If `Monitor` is absent, use the session’s supported background shell execution and retain its process/task handle. Read output while continuing the workflow, and stop that process when done. If background execution is unavailable, run bounded checks in the foreground and recheck during the active session; report the limitation instead of claiming a persistent watch is armed.

Resolve every script path from the calling skill’s directory, not this execution reference.

## Interruption

Use `TaskStop` for a running background worker when exposed. A stopped worker needs a new run. Inspect its worktree and preserve completed changes before restarting the task; stopping a task does not establish that its files or child processes were removed.

Stop processes owned by the interrupted worker and retain useful work until integrated or explicitly discarded. Remove only worktrees and branches whose work has been safely integrated.
