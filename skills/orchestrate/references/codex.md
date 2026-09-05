# Codex execution

Use the current session’s tool descriptions for supported arguments and lifecycle. Tool availability varies between Codex clients.

## Workers

When collaboration tools are available, spawn a worker with a bounded task and retain its agent ID. Conversation inheritance may be configurable; choose it deliberately and keep the brief self-contained. The runtime’s remaining agent slots cap the fleet, including agents already running elsewhere in the session.

For `dev`, `reviewer`, or `researcher`, read `../../../agents/<role>.md`, relative to this reference, and give the worker its task instructions. The Claude registration frontmatter does not register a Codex worker or grant tools. Load the named skills from the current skill catalog and follow the current tool and instruction contracts.

If no delegation capability is available, or no useful work can proceed alongside it, perform the role locally. Continue independent tasks sequentially when capacity is unavailable.

## Isolation

Collaboration workers may share the working directory. For a worker that writes code or checks out a PR, create a separate Git worktree and include its absolute path and base in the brief. Require all commands and edits to use that worktree; do not assume a spawn argument creates it. Disjoint instruction-only file ownership may share a tree.

Record each worktree, branch, and owning worker. Inspect the returned diff and checks before integration. Remove the worktree after the task’s work is safely integrated or preserved on its PR branch, and remove the branch only after merge.

## Watches

Start the calling skill’s watch script with the available shell/process tool and retain the process handle. For sessions exposing `exec_command` and `write_stdin`, keep the returned `session_id` and poll it with `write_stdin`; configure an interruptible process, such as a PTY, so it can be stopped through that handle. Poll waits must leave room for user updates and worker events.

Consume new output and check completion through that handle while the workflow remains active. Stop the process when its owning run ends and verify completion. A yielded tool invocation is not the process itself: distinguish orchestration cell IDs from shell session IDs.

If no resumable process tool is available, use bounded foreground checks and repeat them during the active session. Report that limitation instead of claiming a persistent watch is armed. Resolve script paths from the calling skill’s directory, not this reference.

## Interruption

Use the exposed interruption operation for the target agent, then inspect its status, files, and owned processes. Interruption may end only the current turn and leave the agent available for follow-up. Resume through the available follow-up operation when supported; otherwise start a new worker with the preserved state.

Before resuming after a dependency lands, update the worker’s base and brief. Stop processes it started when ending its task; an interrupted agent is not proof that its shell processes stopped.
