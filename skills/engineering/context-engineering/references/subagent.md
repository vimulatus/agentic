# Worker briefs

A worker owns one task and returns a named deliverable. The main skill's client reference owns registration, tool configuration and context inheritance.

Every brief carries the task, where to read its inputs, the result to return, and the check that establishes completion. Include relevant decisions explicitly so the brief works even without inherited conversation.

| Brief field | Concrete content |
|---|---|
| Task and boundary | One outcome, the files or subsystem owned, and whether edits or external actions are authorized |
| Inputs | Absolute workspace path, relevant files or URLs, required skills, and decisions already made |
| Deliverable | Exact output path or return format; findings include file locations and evidence |
| Completion | The check to run and the result that counts as passing; report a blocker with its evidence if it cannot pass |

```text
Check whether the release manifests disagree. Read /repo/.claude-plugin/plugin.json
and /repo/.codex-plugin/plugin.json. Read-only task; the different plugin names
are intentional. Return both version values and file paths, then MATCH or MISMATCH.
Done when both versions have been parsed and compared; report a read/parse failure
with the affected path instead of guessing a value.
```

Keep reusable role instructions in one place. A client-specific agent definition registers that role; a client without that registration can receive the role body as its brief. Load required skills explicitly when the client does not preload them.

Writing workers use separate worktrees. Read `orchestrate` for scheduling, isolation and verification of their results.

Verify a role with a bounded task and only the context its real caller provides. Inspect the deliverable and the check; a worker's summary alone does not establish completion.
