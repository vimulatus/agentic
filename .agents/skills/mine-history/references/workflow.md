# Mine history

What Vasu corrects is a missing rule. What Vasu retypes is a missing skill. What the agent rebuilds every session is a missing script or hook.

Quote the prompt or the command, or drop the candidate.

A hit is a **coordinate**, not evidence. Read the turns on both sides before you name it. Step 6.

A transcript says what was true that day. Check the claim against disk today.

## Vasu names a tool and asks if it is worth it

Search for the **symptom** it prevents. Its name finds only the day Vasu typed it.

1. Read the tool. Name the failure it exists to stop, in one line.
2. Write that failure as it appears in a transcript: what Vasu types when it happens, what the agent did in the turns before.
3. Mine both corpora for that shape, then steps 5 to 9 as written.
4. Check the tool against disk now: installed, deleted, or never there.

```
Tool        codebase-design
Stops       shipping code with no design pass
Vasu types  "why is this so complex", "you rewrote the whole file", a second ask to restructure
Agent does  edits across 6 files in one task, no read of the module it lands in
```

Count sessions of the symptom, never mentions of the name.

## 1. Read what already exists

Before you mine, read the applicable global and project rule files, shared skills, and client-specific maintenance skills. The client reader names their locations and any additional instruction sources. A candidate that a document already covers is not a candidate.

## 2. Pull corpus A: what Vasu typed

Use the client reader to select session files and extract prompts into `prompts.tsv` under `${TMPDIR:-/tmp}/vimulatus/mine-history/`.

Three columns: full session file, physical line number, prompt. Preserve repeated text across sessions; deduplicate only an identical file-and-line coordinate. Read the whole corpus in one pass. A shard hides the sessions in every other shard, and step 5 counts across sessions.

Default to every project. A project or recent-only request narrows both corpora to the same files. The `length < 400` cut drops pastes and specs. Corrections are short. Raise it to `1200` when the harvest is thin.

## 3. Pull corpus B: what the agent did

Corpus A cannot show a ritual. Vasu never types it.

**Shard by project, not by time.** Use the client reader's project identity; some clients store sessions by date. Take every project over 10 MB as its own shard. Group the rest into one shard.

Load `orchestrate` to assign each shard to a worker using the current client's worker tools. Give it the client reader, selected session files, and this brief. If workers are unavailable, process the same shards sequentially.

> Extract actions to a temporary file. Three columns: full session file, physical line number, action, in the order they ran.
> Find every **ritual**: the same commands, in the same order, rebuilt in 3 or more distinct sessions.
>
> A ritual is a sequence, not a command. `git status` and `grep` rank high because they are primitives.
> A ritual runs 3 or more steps in a fixed order, carries flags or paths or a container name, and is
> a sequence a reader would otherwise have to reconstruct. Drop everything else.
> Keep a sequence where writing it down removes a decision. Drop one where it states the obvious.
>
> Read the windows in step 6 before counting each session. Return one block per ritual and nothing else.
>
> ```
> Ritual    <name it in four words>
> Sequence  <the commands, in order>
> Sessions  <count, with full session files and line coordinates>
> Fixed     <what never changes>
> Varies    <what changes each time>
> ```
>
> Return an empty list when you find no ritual. Do not pad it.

The parent reads the blocks and evidence windows, not the action files.

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
| B | the distinct sessions documented in each returned block |
| B, across projects | a ritual found in 2 or more projects is a global candidate. One project means it belongs there; keep project identities when grouping small shards |

Read the window, step 6, before a hit joins a count. A hit you read alone inflates the count.

A rule built from one session is a rule the agent has to fight later.

## 6. Read the window on both sides

Every hit, before you call it a finding. The turns before it hold the cause. The turns after it hold whether the cause survived.

Start eight physical lines before and after the recorded line, using the client reader. Expand until the preceding cause and following response are visible. A token event, tool result, or truncated preview is not a turn; read the full records when the preview hides the decision.

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
| A house choice no document states | one line in the applicable rule file |
| A stated rule that lost anyway | rewrite that line. Do not add a second one |
| How the answer should read | the client reader’s answer-style home |
| A step the agent skipped, in work a skill already owns | a step in that skill |
| A command with flags Vasu retypes | one line in the applicable rule file |
| A ritual the agent rebuilds, where the steps are stable but the judgment is not | a new skill |
| A ritual where nothing varies but the arguments | a script or a CLI, and one line in the applicable rule file that names it |
| A ritual that must fire without being asked | a supported hook in the current client; use `context-engineering` to check the event and configuration |

"Every time X happens, do Y" is a hook. A skill fires when the model chooses it. A hook fires because the harness runs it.

One home each. A finding that wants two homes is two findings, or it is one you have not named yet.

## 8. Report

Per survivor, five lines. Ranked by session count.

```
Candidate  <the name, or the rule as one line>
Evidence   "<quote>", or the command shape  x<N> sessions
Cause      what the agent did instead
Home       skill | script | hook | rule file | answer style | existing skill <name>
Cost       what the user stops typing
```

Stop there. The user picks what lands.

## 9. Build what Vasu picks

| Vasu picks | Route to |
|---|---|
| a skill | `create-skill` |
| a rule, a rewrite, an answer-style edit | `context-engineering` |
| a hook | `context-engineering`, using the current client reference |
| a script | write it, then name it in the owning skill or applicable rule file |
