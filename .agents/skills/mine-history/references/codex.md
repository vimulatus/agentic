# Codex history reader

Read this repo's `AGENTS.md`, `codex/AGENTS.md`, `skills/`, and `.agents/skills/`, plus the applicable project rules. Answer-style preferences live in the owning shared skill or global rule file. Route proposed hooks through `context-engineering`; verify the installed client's supported events and configuration before proposing a hook as enforceable.

## Select sessions

Discover JSONL files with `rg --files --hidden "${CODEX_HOME:-$HOME/.codex}/sessions" -g '*.jsonl'`. These directories are dates, not projects. For each file, set `F` to its absolute path and inspect its metadata:

```bash
jq -r 'select(.type == "session_meta") | .payload
  | [.id, .cwd, (.source | tojson)] | @tsv' "$F"
```

Group by metadata `cwd`; combine known worktrees of the same repository. Exclude sessions whose `source` is an object containing `subagent` from independent session counts. For recent-only scope, filter by the metadata timestamp; for one project, filter by `cwd`. Apply the resulting file selection to both corpora.

The examples match local rollout records inspected in September 2026. Inspect record keys if extraction is empty or the schema differs; report unreadable sessions rather than treating them as evidence of no recurrence.

## Corpus A

Run once per selected file, appending to a fresh `prompts.tsv` in the task's temporary directory. `input_line_number` is a physical coordinate because each invocation reads one file.

```bash
jq -rR --arg file "$F" '
  input_line_number as $line | fromjson?
  | select(.type == "event_msg" and .payload.type == "user_message")
  | .payload.message | select(type == "string")
  | select(length < 400) | select(startswith("<") | not)
  | [$file, $line, gsub("\\s+"; " ")] | @tsv' "$F"
```

Use `event_msg.user_message` once. `response_item` user messages can repeat that prompt and also contain injected context; combining both doubles evidence.

## Corpus B

Run once per selected file in a project shard, appending in file order to its fresh action file:

```bash
jq -rR --arg file "$F" '
  input_line_number as $line | fromjson?
  | select(.type == "response_item") | .payload
  | select(.type == "function_call" or .type == "custom_tool_call")
  | (.arguments // .input // "") as $args
  | [$file, $line, (.name + " " +
      ($args | if type == "string" then . else tojson end)
      | gsub("\\s+"; " ") | .[0:300])] | @tsv' "$F"
```

Function arguments may be JSON strings; custom tools may contain executable text, including multiple nested tool calls. The preview locates evidence. Read the full call to recover command order and flags before naming a ritual; a wrapper tool's name is not a command sequence.

## Evidence window

Set `N` to the recorded line number, then start with this preview:

```bash
sed -n "$(( N>8 ? N-8 : 1 )),$((N+8))p" "$F" | jq -rR '
  fromjson?
  | select((.type == "response_item" and .payload.type != "reasoning")
      or (.type == "event_msg" and
          (.payload.type == "user_message" or .payload.type == "agent_message")))
  | "[\(.type)/\(.payload.type)] " + (.payload | tojson | .[0:1000])'
```

Expand the line range until both sides of the exchange appear. Remove the preview truncation when it hides the cause or outcome. Count the user event and its matching response-item copy as one turn.
