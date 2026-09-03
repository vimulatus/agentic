# Hook

A hook runs at a harness event. Claude did not choose it, and cannot skip it.

## Where it lives

| File | Fires |
|---|---|
| `hooks/hooks.json` in the plugin | every session with the plugin on |
| `.claude/settings.json`, `~/.claude/settings.json` | every session in that project, or every project |
| `hooks:` in a skill's frontmatter | for the rest of the session, once the skill fires. `once: true` fires it one time |
| `hooks:` in a subagent's frontmatter | while that subagent runs |

Every registered hook fires. They merge, they do not override.

## The kinds

| `type` | Runs | Reach for it when |
|---|---|---|
| `command` | a shell command | the check is a match: a string, a path, an exit code |
| `prompt` | one model call, no tools | the check needs reading: "is this diff safe to push?" |
| `agent` | a subagent with tools | the check needs looking: run the tests, open the file. Experimental |

## The events

| Event | When | Can block |
|---|---|---|
| `SessionStart` | a session begins or resumes | |
| `UserPromptSubmit` | you send a prompt, before Claude reads it | yes |
| `PreToolUse` | before a tool call | yes |
| `PermissionRequest` | a tool call needs a decision | decides it |
| `PostToolUse` | after a tool call succeeds | |
| `PostToolUseFailure` | after a tool call fails | |
| `SubagentStart`, `SubagentStop` | a worker spawns, a worker returns | |
| `Stop` | Claude finishes a turn | yes: it keeps working |
| `SessionEnd` | the session closes | |

The full list, with each event's JSON, sits at <https://code.claude.com/docs/en/hooks>.

`matcher` narrows a tool event to a tool: `Bash`, `Edit|Write`, a regex, or `mcp__<server>__<tool>`. No matcher means every tool.

## The contract

The hook reads one JSON object on stdin: `session_id`, `cwd`, `hook_event_name`, and for a tool event `tool_name`, `tool_input`, and on `PostToolUse` the `tool_response`.

| Exit | Means |
|---|---|
| `0` | fine. Stdout is read as JSON when it parses |
| `2` | block. Stderr goes to Claude as the reason |
| other | fine, with a warning. Stderr goes to you |

The JSON on exit 0:

```json
{ "hookSpecificOutput": { "hookEventName": "PostToolUse",
                          "additionalContext": "text Claude reads next turn" } }
{ "hookSpecificOutput": { "hookEventName": "PreToolUse",
                          "permissionDecision": "deny", "permissionDecisionReason": "why" } }
{ "systemMessage": "a line you see, not Claude" }
```

`additionalContext` is the only line a hook adds to context. Everything else costs nothing.

## Write it

- Exit `0` fast on the case the hook is not for. Most events are not yours.
- Parse with `jq`. The fields are nested, and a grep on the raw payload matches the wrong tool.
- Path the script from the file that registers it: `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh` in a plugin, `${CLAUDE_PROJECT_DIR}/.claude/hooks/<name>.sh` in a project.
- `timeout` in seconds. A hook that hangs holds the turn.

```
Worked: hooks/pr-opened.sh, PostToolUse, matcher Bash.

  not `gh pr create`  -> exit 0, no output               most Bash calls
  no PR URL in the response -> exit 0, no output           the create failed
  a URL             -> additionalContext: "Load the pr skill. Start at step 3"
```

Verify by causing the event. A hook that never fires is a matcher bug: check the tool name and the regex first.
