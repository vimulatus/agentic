---
name: mine-history
description: Read past sessions to find what Claude keeps getting wrong and what it keeps rebuilding, then propose the skill, script, hook, or rule that fixes it. Use when the user asks what skills he should build, what he could automate, what he keeps repeating or correcting, or to mine his history. Not for this session, which is retro.
---

# Mine history

What he corrects is a missing rule. What he retypes is a missing skill. What Claude rebuilds every session is a missing script or hook.

Quote the prompt or the command, or drop the candidate. A pattern you infer without evidence is a guess.

## 1. Read what already exists

Before you mine. A candidate that a document already covers is not a candidate.

```bash
cat /home/vasu/projects/agentic/CLAUDE.md
ls /home/vasu/projects/agentic/skills/ /home/vasu/projects/agentic/.claude/skills/
cat /home/vasu/projects/agentic/output-styles/*.md
```

## 2. Pull corpus A: what he typed

```bash
cd ~/.claude/projects
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

Do not shard corpus A. It is small, and step 5 counts a pattern across sessions. A shard hides the sessions in every other shard, so sharding destroys the count it depends on.

| Scope | Change |
|---|---|
| Every project (default) | as written |
| One project | replace `.` with `./-home-vasu-projects-<name>` |
| Recent only | add `-mtime -30` to `find` |

The `length < 400` cut drops pastes and specs. Corrections are short. Raise it to `1200` when the harvest is thin.

Both corpora take the same three scope changes.

## 3. Pull corpus B: what Claude did

Corpus A cannot show a ritual Claude rebuilds every session. He never types it, so it never lands in his prompts.

This corpus is large: over 20,000 tool calls, and one project alone runs ~58k tokens of ordered actions. Fan out.

**Shard by project, not by time.** A ritual belongs to a project. A ritual that two project agents both name is a global one, so the shard boundary doubles as the confidence test.

```bash
du -sm /home/vasu/.claude/projects/*/ | sort -rn | head -8
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

A long instruction he types from scratch every time is the strongest repeat. It is a skill body he is writing by hand.

A ritual is a **sequence**, not a command. `git status` ranks high because it is a primitive. Claude reaches for it the way it reaches for a verb, and no document changes that.

| Ritual | Primitive |
|---|---|
| Three or more steps, in a fixed order | One step |
| Claude gets the order wrong sometimes | Claude never gets it wrong |
| The steps carry flags, paths, or a container name | Bare, or the argument is the task |
| Writing it down removes a decision | Writing it down states the obvious |

## 5. Count sessions, not hits

**3 or more sessions** to survive. Two prompts in one session is one event.

| Corpus | Count |
|---|---|
| A | distinct session files in column 1 |
| B | the `Sessions` line each agent returned |
| B, across shards | a ritual named by 2 or more agents is a global candidate. One agent means it belongs to that project |

Drop everything below the line. One-offs are noise, and a rule built from one is a rule Claude has to fight later.

## 6. Read the turn that caused it

Only for the survivors. A correction without the action before it has no cause.

```bash
F=<column 1>; U=<column 2>
N=$(grep -n "$U" "$F" | head -1 | cut -d: -f1)
sed -n "$((N-6)),$((N))p" "$F" | jq -rR 'fromjson? | select(.message)
  | "[\(.type)] " + (.message.content
    | if type=="string" then .
      else [.[] | if .type=="text" then .text elif .type=="tool_use" then "«\(.name)»" else empty end] | join(" ")
      end
    | gsub("\\s+";" ") | .[0:300])'
```

## 7. Route each survivor to one home

| The finding | Home |
|---|---|
| A workflow with steps, tools, and a done state | a new skill |
| A house choice no document states | one line in `CLAUDE.md` |
| A stated rule that lost anyway | rewrite that line. Do not add a second one |
| How the answer should read | `output-styles/cheat-sheet.md` |
| A step Claude skipped, in work a skill already owns | a step in that skill |
| A command with flags he retypes | one line in `CLAUDE.md` |
| A ritual Claude rebuilds, where the steps are stable but the judgment is not | a new skill |
| A ritual where nothing varies but the arguments | a script or a CLI, and one line in `CLAUDE.md` that names it |
| A ritual that must fire without being asked | a hook in `settings.json`, via `update-config` |

The last row is the only home Claude cannot reach on its own. A skill fires when the model chooses it. A hook fires because the harness runs it. "Every time X happens, do Y" is a hook.

One home each. A finding that wants two homes is two findings, or it is one you have not named yet.

## 8. Report

Per survivor, five lines. Ranked by session count.

```
Candidate  <the name, or the rule as one line>
Evidence   "<quote>", or the command shape  x<N> sessions
Cause      what Claude did instead
Home       skill | script | hook | CLAUDE.md | output style | existing skill <name>
Cost       what the user stops typing
```

Stop there. The user picks what lands.

## 9. Build what he picks

| He picks | Route to |
|---|---|
| a skill | `create-skill` |
| a rule, a rewrite, an output-style edit | `context-engineering` |
| a hook | `update-config` |
| a script | write it, then name it in `CLAUDE.md` |
