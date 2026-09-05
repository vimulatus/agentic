# Hook

A hook runs at a harness event. The model did not choose it, and cannot skip it.

## Where it lives

| File | Fires |
|---|---|
| `hooks/hooks.json` in the plugin | every Claude Code or Codex session with the plugin on |
| `.claude/settings.json`, `~/.claude/settings.json` | every session in that project, or every project |
| `.codex/hooks.json`, `~/.codex/hooks.json` | every Codex session in that project, or every project |
| `hooks:` in a skill's frontmatter | for the rest of the session, once the skill fires. `once: true` fires it one time |
| `hooks:` in a subagent's frontmatter | while that subagent runs |

Every registered hook fires. They merge, they do not override.

## The kinds

| `type` | Runs | Reach for it when |
|---|---|---|
| `command` | a shell command | the check is a match: a string, a path, an exit code |
| `prompt` | one model call, no tools; Claude Code only | the check needs reading: "is this diff safe to push?" |
| `agent` | a subagent with tools; Claude Code only | the check needs looking: run the tests, open the file. Experimental |

## The events

| Event | When | Can block |
|---|---|---|
| `SessionStart` | a session begins or resumes | |
| `UserPromptSubmit` | you send a prompt, before the agent reads it | yes |
| `PreToolUse` | before a tool call | yes |
| `PermissionRequest` | a tool call needs a decision | decides it |
| `PostToolUse` | after a tool call succeeds | |
| `PostToolUseFailure` | after a tool call fails; Claude Code only | |
| `SubagentStart`, `SubagentStop` | a worker spawns, a worker returns | |
| `Stop` | the agent finishes a turn | yes: it keeps working |
| `SessionEnd` | the session closes | |

The full event contracts sit at <https://code.claude.com/docs/en/hooks> for Claude Code and <https://learn.chatgpt.com/docs/hooks> for Codex.

`matcher` narrows a tool event to a tool: `Bash`, `Edit|Write`, a regex, or `mcp__<server>__<tool>`. No matcher means every tool.

Claude Code's `if` field narrows one hook to a call in permission-rule syntax: `"if": "Bash(gh pr create *)"`. Codex does not support `if`; it matches the tool name and runs the handler. A hook shared by both runtimes must repeat the command test inside its script. Keep one shared handler for multiple command patterns so Codex does not run duplicate copies concurrently.

## The contract

The hook reads one JSON object on stdin: `session_id`, `cwd`, `hook_event_name`, and for a tool event `tool_name`, `tool_input`, and on `PostToolUse` the `tool_response`.

| Exit | Means |
|---|---|
| `0` | fine. Stdout is read as JSON when it parses |
| `2` | block. Stderr goes to the runtime as the reason |
| other | fine, with a warning. Stderr goes to you |

The JSON on exit 0:

```json
{ "hookSpecificOutput": { "hookEventName": "PostToolUse",
                          "additionalContext": "text the agent reads next turn" } }
{ "hookSpecificOutput": { "hookEventName": "PreToolUse",
                          "permissionDecision": "deny", "permissionDecisionReason": "why" } }
{ "systemMessage": "a line the user sees" }
```

`additionalContext` is the only line a hook adds to context. Everything else costs nothing.

## Write it

- Exit `0` fast on the case the hook is not for. Most events are not yours.
- Parse with `jq`. The fields are nested, and a grep on the raw payload matches the wrong tool.
- Path a shared plugin script as `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh`. Codex sets that compatibility variable as well as its native `PLUGIN_ROOT`.
- Codex requires each new or changed non-managed hook definition to be reviewed and trusted through `/hooks` before it runs.
- `timeout` in seconds. A hook that hangs holds the turn.

```
Worked: hooks/pr-opened.sh, PostToolUse, matcher Bash. The script accepts `gh pr create` and `gh stack submit` itself.

  any other call            -> exit 0, no output            most Bash calls
  no PR URL in the response -> exit 0, no output            the create failed
  a URL                     -> additionalContext: "Load the pr skill and arm the watch"
```

Verify by causing the event. A hook that never fires is a matcher bug: check the tool name and the regex first.
