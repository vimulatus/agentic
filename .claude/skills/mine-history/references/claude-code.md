# Claude Code history reader

Read this repo's `CLAUDE.md`, `claude/CLAUDE.md`, `skills/`, `.claude/skills/`, and `output-styles/`, plus the applicable project rules. Claude-only answer-style findings belong in the active output style; shared preferences belong in the owning shared skill or mirrored global rules. Route hooks through `context-engineering` to verify events and the appropriate settings file.

## Select sessions

Discover JSONL files with `rg --files --hidden "$HOME/.claude/projects" -g '*.jsonl' -g '!**/subagents/**'`. Project directories supply the initial shards. Combine known worktrees of the same repository. Set `F` to an absolute session-file path for each extraction.

For one project, narrow to its project directory. For recent-only scope, filter session files by their record timestamps. Use the same selected files for both corpora. Inspect record keys if extraction is empty or the schema differs; report unreadable sessions rather than treating them as evidence of no recurrence.

## Corpus A

Run once per selected file, appending to a fresh `prompts.tsv` in the task's temporary directory:

```bash
jq -rR --arg file "$F" '
  input_line_number as $line | fromjson?
  | select(.type == "user" and (.isSidechain // false | not)
      and (.isMeta // false | not))
  | .message.content | select(type == "string")
  | select(length < 400) | select(startswith("<") | not)
  | [$file, $line, gsub("\\s+"; " ")] | @tsv' "$F"
```

The line coordinate replaces UUID lookup and survives repeated text. `input_line_number` is local to the file because each invocation reads one file.

## Corpus B

Run once per selected file in a project shard, appending in file order to its fresh action file:

```bash
jq -rR --arg file "$F" '
  input_line_number as $line | fromjson?
  | select(.type == "assistant" and (.isSidechain // false | not))
  | .message.content | select(type == "array") | .[]
  | select(.type == "tool_use")
  | [$file, $line, (.name + " " + (.input | tojson)
      | gsub("\\s+"; " ") | .[0:300])] | @tsv' "$F"
```

Read full tool inputs in the evidence window when the preview truncates command order or flags.

## Evidence window

Set `N` to the recorded line number, then start with this preview:

```bash
sed -n "$(( N>8 ? N-8 : 1 )),$((N+8))p" "$F" | jq -rR '
  fromjson? | select(.message)
  | "[\(.type)] " + (.message.content
    | if type == "string" then . else tojson end | .[0:1000])'
```

Expand the line range until both sides of the exchange appear. Remove the preview truncation when it hides the cause or outcome.
