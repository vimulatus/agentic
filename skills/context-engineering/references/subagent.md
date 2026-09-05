# Worker briefs

A worker owns one task and returns a named deliverable. The main skill's client reference owns registration, tool configuration and context inheritance.

Every brief carries the task, where to read its inputs, the result to return, and the check that establishes completion. Include relevant decisions explicitly so the brief works even without inherited conversation.

Keep reusable role instructions in one place. A client-specific agent definition registers that role; a client without that registration can receive the role body as its brief. Load required skills explicitly when the client does not preload them.

Writing workers use separate worktrees. Read `orchestrate` for scheduling, isolation and verification of their results.

Verify a role with a bounded task and only the context its real caller provides. Inspect the deliverable and the check; a worker's summary alone does not establish completion.
