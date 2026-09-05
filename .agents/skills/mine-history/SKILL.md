---
name: mine-history
description: Mine past sessions for what Codex keeps getting wrong or rebuilding, then propose the fix.
disable-model-invocation: true
---

# Mine history

What Vasu corrects is a missing rule. What Vasu retypes is a missing skill. What Codex rebuilds every session is a missing script or hook.

Quote the prompt or the command, or drop the candidate.

A hit is a **coordinate**, not evidence. Read the turns on both sides before you name it. Step 6.

A transcript says what was true that day. Check the claim against disk today.

## Vasu names a tool and asks if it is worth it

Search for the **symptom** it prevents. Its name finds only the day Vasu typed it.

1. Read the tool. Name the failure it exists to stop, in one line.
2. Write that failure as it appears in a transcript: what Vasu types when it happens, what Codex did in the turns before.
3. Mine both corpora for that shape, then steps 5 to 9 as written.
4. Check the tool against disk now: installed, deleted, or never there.

```
Tool      codebase-design
Stops     Codex shipping code with no design pass
Vasu types  "why is this so complex", "you rewrote the whole file", a second ask to restructure
Codex    Edit across 6 files in one task, no read of the module it lands in
```

Count sessions of the symptom, never mentions of the name.

## 1. Read what already exists

Before you mine. A candidate that a document already covers is not a candidate.

```bash
cat ~/Documents/projects/agentic/AGENTS.md
ls ~/Documents/projects/agentic/skills/ ~/Documents/projects/agentic/.Codex/skills/
cat ~/Documents/projects/agentic/output-styles/*.md
```

## 2. Pull corpus A: what Vasu typed

```bash
cd ~/.Codex/projects
find . -name '*.jsonl' -print0 | xargs -0 jq -rR '
  fromjson?
  | select(.type=="user" and .isSidechain==false and (.isMeta//false|not))
  | select(.message.content | type=="string")
  | select(.message.content | length < 400)
  | select(.message.content | startswith("<") | not)
  | "\(input_filename)\t\(.uuid)\t\(.message.content | gsub("\\s+";" "))"' 2>/dev/null \
  | sort -u -t$'\t' -k3 > /tmp/prompts.tsv
wc -l /tmp/prompts.tsv
```

Three columns: session file, turn uuid, the prompt. Read the whole file in one pass.

Do not shard corpus A. A shard hides the sessions in every other shard, and step 5 counts across sessions.

| Scope | Change |
|---|---|
| Every project (default) | as written |
| One project | replace `.` with `./-Users-vasumittal-Documents-projects-<name>` |
| Recent only | add `-mtime -30` to `find` |

The `length < 400` cut drops pastes and specs. Corrections are short. Raise it to `1200` when the harvest is thin.

Both corpora take the same three scope changes.

## 3. Pull corpus B: what Codex did

Corpus A cannot show a ritual. Vasu never types it.

This corpus is large: over 20,000 tool calls. Fan out.

**Shard by project, not by time.** A ritual belongs to a project. A ritual that two project agents both name is a global one, so the shard boundary doubles as the confidence test.

```bash
du -sm ~/.Codex/projects/*/ | sort -rn | head -8
```

Take every project over 10M as its own shard. Group the rest into one shard.

Run one subagent per shard, all in one message. Give each this command with `<SHARD>` replaced, and this brief:

```bash
find <SHARD> -name '*.jsonl' -print0 | xargs -0 jq -rR '
  fromjson? | select(.type=="assistant") | . as $r | .message.content
  | select(type=="array") | .[] | select(.type=="tool_use")
  | "\($r.sessionId[0:8])\t" + (if .name=="Bash"
      then ((.input.command//"") | gsub("^cd [^&;]+&& *";"") | gsub("\\s+";" ") | .[0:90])
      else .name end)' 2>/dev/null > /tmp/actions-<SHARD-NAME>.tsv
```

> Read the file. Two columns: session, action, in the order they ran.
> Find every **ritual**: the same commands, in the same order, rebuilt in 3 or more distinct sessions.
>
> A ritual is a sequence, not a command. `git status` and `grep` rank high because they are primitives.
> A ritual runs 3 or more steps in a fixed order, carries flags or paths or a container name, and is
> a sequence a reader would otherwise have to reconstruct. Drop everything else.
> Keep a sequence where writing it down removes a decision. Drop one where it states the obvious.
>
> Return one block per ritual and nothing else. No prose, no summary.
>
> ```
> Ritual    <name it in four words>
> Sequence  <the commands, in order>
> Sessions  <count>
> Fixed     <what never changes>
> Varies    <what changes each time>
> ```
>
> Return an empty list when you find no ritual. Do not pad it.

The parent never reads the action files. It reads the blocks.

## 4. Sort into three signals

| Signal | Corpus | Shape | Becomes |
|---|---|---|---|
| **Correction** | A | "no", "that is wrong", "too long", a rewritten instruction, a question asked twice | a rule |
| **Repeat** | A | the same setup, the same constraint, the same ceremony typed in new sessions | a skill |
| **Ritual** | B | the same commands, in the same order, rebuilt from scratch in new sessions | a skill, a script, or a hook |

A long instruction Vasu types from scratch every session is the strongest repeat. It is a skill body Vasu writes by hand.

## 5. Count sessions, not hits

**3 or more sessions** to survive. Two prompts in one session is one event.

| Corpus | Count |
|---|---|
| A | distinct session files in column 1 |
| B | the `Sessions` line each agent returned |
| B, across shards | a ritual named by 2 or more agents is a global candidate. One agent means it belongs to that project |

Read the window, step 6, before a hit joins a count. A hit you read alone inflates the count.

A rule built from one session is a rule Codex has to fight later.

## 6. Read the window on both sides

Every hit, before you call it a finding. The turns before it hold the cause. The turns after it hold whether the cause survived.

```bash
F=<column 1>; U=<column 2>
N=$(grep -n "$U" "$F" | head -1 | cut -d: -f1)
sed -n "$(( N>8 ? N-8 : 1 )),$((N+8))p" "$F" | jq -rR 'fromjson? | select(.message)
  | "[\(.type)] " + (.message.content
    | if type=="string" then .
      else [.[] | if .type=="text" then .text elif .type=="tool_use" then "«\(.name)»" else empty end] | join(" ")
      end
    | gsub("\\s+";" ") | .[0:300])'
```

| The window shows | Read the hit as |
|---|---|
| Vasu restates the same ask after the answer | the answer missed. A finding |
| Vasu accepts and moves on | the answer landed. Not a finding |
| Vasu is quoting a document, or pasting output | not Vasu's words. Drop it |
| The tool or path Vasu names is gone from disk | true that day, stale today |

## 7. Route each survivor to one home

| The finding | Home |
|---|---|
| A workflow with steps, tools, and a done state | a new skill |
| A house choice no document states | one line in `AGENTS.md` |
| A stated rule that lost anyway | rewrite that line. Do not add a second one |
| How the answer should read | `output-styles/cheat-sheet.md` |
| A step Codex skipped, in work a skill already owns | a step in that skill |
| A command with flags Vasu retypes | one line in `AGENTS.md` |
| A ritual Codex rebuilds, where the steps are stable but the judgment is not | a new skill |
| A ritual where nothing varies but the arguments | a script or a CLI, and one line in `AGENTS.md` that names it |
| A ritual that must fire without being asked | a hook in `settings.json`, via `update-config` |

"Every time X happens, do Y" is a hook. A skill fires when the model chooses it. A hook fires because the harness runs it.

One home each. A finding that wants two homes is two findings, or it is one you have not named yet.

## 8. Report

Per survivor, five lines. Ranked by session count.

```
Candidate  <the name, or the rule as one line>
Evidence   "<quote>", or the command shape  x<N> sessions
Cause      what Codex did instead
Home       skill | script | hook | AGENTS.md | output style | existing skill <name>
Cost       what the user stops typing
```

Stop there. The user picks what lands.

## 9. Build what Vasu picks

| Vasu picks | Route to |
|---|---|
| a skill | `create-skill` |
| a rule, a rewrite, an output-style edit | `context-engineering` |
| a hook | `update-config` |
| a script | write it, then name it in `AGENTS.md` |
