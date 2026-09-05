# Hook handlers

A hook runs at a harness event when it is registered, enabled and trusted as required by the client. Read the target client's reference from `SKILL.md` for registration and the event contract.

## Input

Command hooks read one JSON object from stdin. These fields are shared by Claude Code and Codex; tool payload contents depend on the tool.

| Field | Available on | Use |
|---|---|---|
| `session_id`, `cwd`, `hook_event_name` | The events below | Session identity, working directory and event routing |
| `source` | `SessionStart` | Why the session started |
| `prompt` | `UserPromptSubmit` | Submitted user text |
| `tool_name`, `tool_input` | `PreToolUse`, `PostToolUse` | Tool identity and JSON arguments |
| `tool_response` | `PostToolUse` | Tool result; inspect its actual shape before extracting text |
| `stop_hook_active` | `Stop` | Whether a stop hook already caused continuation; guard against repeated blocking |

Parse JSON with `jq`; matching raw payload text can select the wrong field. A shared handler accepts the inputs both clients actually send, and ignores unrelated calls even when a client applies an additional registration filter.

## Output

| Outcome | Synchronous command response |
|---|---|
| Unrelated input | Exit 0 with empty stdout |
| Add model instructions | Exit 0 with the context JSON below |
| Deny a tool before execution | Exit 0 with the `PreToolUse` denial JSON below, or exit 2 with a nonempty reason on stderr |
| Report a handler failure | Nonzero status other than 2, with diagnostics on stderr; this is not a portable blocking mechanism |

`SessionStart`, `UserPromptSubmit`, `PreToolUse` and `PostToolUse` share this context response. Set `hookEventName` to the event being handled; this is not a universal envelope for every event.

```json
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Load the pr skill and arm its watch for the PR just opened."}}
```

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"This command writes to the live database; use the approved migration procedure."}}
```

Emit one JSON object on stdout, with no log lines, and exit 0 when using JSON decisions. A `PostToolUse` response cannot undo a tool that already ran. A `Stop` continuation needs its own response: read the target client's reference before choosing warning, feedback or blocking behavior.

Keep timeouts bounded. Name skills in emitted prose without a hard-coded client namespace. Hook compatibility variables do not imply the same variables exist in skill bodies.

Exercise the relevant input and an unrelated input in both clients. Check the result at the event boundary as well as by running the script: valid handler output does not prove that registration caused it to run.

Contract checked against the [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) and Codex [input/output schemas at rust-v0.153.4](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/hooks/src/schema.rs). Recheck the installed runtime when changing event behavior.
