---
name: context-engineering
description: Pick the home and write the lines - CLAUDE.md, rule, skill, script, hook or subagent. Use before you add or edit one, when a skill does not fire, or when one runs long.
---

# Context engineering

A document holds the opinions Claude cannot derive: your commands, your house choices, your taste. Claude supplies the rest.

Write less than feels safe.

## Three verbs

Everything you write for Claude is **loaded**, **fires**, or **runs**. The verb sets the cost and the guarantee.

| Verb | When | Costs | Guarantee |
|---|---|---|---|
| **loaded** | every turn, every session | context on every request | Claude reads it. It may still not act |
| **fires** | when Claude picks it, or you type it | a description while it waits, the body when it fires | Claude reads it then. It may still not act |
| **runs** | when the harness reaches the event | nothing, unless it returns text | it happens. Claude did not choose |

A loaded line is a request. A fired line is a request that waits. Only a run is a guarantee.

## The home

One home per line. Pick it by the trigger, before you write.

| The line | Home | Verb |
|---|---|---|
| must happen every time, and needs no judgment | a **hook** | runs |
| a command Claude repeats verbatim | a **script** the skill calls | runs |
| a fact every session needs | `CLAUDE.md` | loaded |
| a fact only some files need | a **rule**: `.claude/rules/<topic>.md` with `paths:` | loaded on the match |
| a procedure with judgment in it | a **skill** | fires |
| detail only some runs of a skill reach | a **reference** the skill points at | fires on the pointer |
| a read that would flood the context, or a worker with fixed instructions | a **subagent** | fires |
| a connection to an outside system | an MCP server | loaded, names only |

"Every time X, do Y" is a hook. In prose it is a request Claude usually honours. As a hook it happens.

"Never do X" in prose puts X into context and hopes. A `PreToolUse` hook that exits 2 blocks it.

```
Worked: after `gh pr create`, the pr skill must take over. Every time, no judgment.

  a CLAUDE.md line  "after you open a PR, load pr"   -> loaded. Honoured on most turns
  hooks/pr-opened.sh on PostToolUse, matcher Bash    -> runs. Reads the URL and returns
                                                        "Load the pr skill. Start at step 3"
```

A line that wants two homes is two lines.

Read `references/hook.md` to write the hook: the events, the exit codes, the output shape. Read `references/subagent.md` to write the subagent: the frontmatter, and what the worker sees.

## Write only what Claude cannot derive

Before each line, ask:

> Does this change what Claude does, compared to no line at all?

Name the changed behavior. If you cannot name it, do not write the line.

| Write this | Not this |
|---|---|
| The command and its flags: `agent-browser record start <out.webm> <url>` | A step list for recording a screen |
| The house choice: "one HTML file, plain CSS, no build step" | "Prototypes should stay simple" |
| The gotcha no config confesses: "the staging DB resets at 03:00 UTC" | Anything `package.json` or `--help` already says |
| The taste call: "3 to 5 variants, different structure, not different colors" | "Make good variants" |
| The standard: "match the comment density of the surrounding code" | "No comments. Never write multi-paragraph docstrings" |

The last row carries the most weight. Give the standard and let Claude judge. A list of forbidden cases fights that judgment, and it loses to the first case you did not list.

Where you hold no opinion, write nothing. A rule invented to fill a gap is a rule Claude has to fight.

## State the opinion

State it. Stop. Claude does not need the paragraph around it.

```
Rambling:  Because prototypes get thrown away, and because build tooling
           adds setup cost that rarely pays off this early, it is usually...
Opinion:   - One HTML file. Plain CSS. No build step.
```

Give the reason only when the reason decides a fork. Otherwise the bullet is the whole instruction.

## Leading words

A **leading word** is one word that carries a whole behavior, because the model already holds its meaning. Repeat the word. Never re-explain it.

| Spelled out | Leading word |
|---|---|
| "fast, deterministic, low-overhead" | a **tight** loop |
| "a failing test you trust to catch this exact bug" | the loop goes **red** |
| "how far a mistake here can spread" | **blast radius** |

- Reach for a word the model already knows. A coined word carries nothing, so you pay in definition what a pretrained word gives free.
- Grade the word against the default. "Be thorough" loses to a model that is already thorough-ish. **Relentless** wins.
- Use the same word in your prompts, your documents, and your code. Shared vocabulary is what makes a skill fire.

Hunt for the passage that collapses into one word.

## Form

One heading per branch. A table or a code block per rule set. Prose only where both of those fail, and four lines at most.

- Prompt the positive. A prohibition puts the banned behavior into context and makes it more available, not less. Write "match the surrounding style", not "do not invent a new style".
- Keep a concept whole. Its definition, its rules and its caveats sit under one heading. A reader who lands on one part gets the neighbors free.
- State what done looks like when it is checkable. "Every changed model has a migration" drives more work than "update the migrations".
- Write standing instructions. Claude reads a skill once, at the fire, and never again in that task.

## Layers

A skill is four layers. Each one costs only when reached.

```
<skill>/
├── SKILL.md                fires with the skill    what every run needs
├── references/<topic>.md   fires on a pointer      what only some runs need
└── scripts/<name>.sh       never read. Runs        what no run needs to see
```

The description is the layer above all three. It is loaded on every turn.

Branching is the test. Inline what every branch needs. Move out what only some branches reach.

| The file | Do |
|---|---|
| Every run reads all of it | Keep one file. When it runs long, cut lines |
| Only some runs reach a section | `references/<topic>.md`. Point at it |
| A later step tempts Claude to call the job done early | Move the later step out. Out of view, it stops competing |
| Every run executes it, and no run reads it | `scripts/<name>.sh`. One line calls it |

```
Worked: the prototype skill branches Logic and UI.
        Both branches publish      -> the publish command stays in-file.
        Only Logic draws a machine -> references/logic.md.
```

A pointer to a reference is a description too. A must-have file behind a weak pointer is a variance bug: some runs open it, some do not.

```
See the reference file for more details.        <- Claude decides. It decides no.

Read references/logic.md for the state-machine  <- a trigger.
notation. Use when the prototype models a flow
or a backend state machine.
```

One level deep. A reference that points at a second reference gets a `head -100`, not a read.

`SKILL.md` under 500 lines is the published limit. A skill that nears it holds a branch it has not moved out.

## Scripts

A script moves out what every run *executes* and no run *reads*. Shell that Claude runs verbatim is a script. Shell that Claude edits for the task stays inline, because it has to see the shape to change it.

The call is absolute, because Claude's shell starts in the project and moves with every `cd`.

```
${CLAUDE_SKILL_DIR}/scripts/<name>.sh --flag <arg>
```

Say **run** or **see**. "Run `queue-list.sh` for the open issues" executes it. "See `queue-list.sh` for the query" reads it, and a 40-line script becomes 40 loaded lines.

- One script with a flag beats two scripts that differ by four lines.
- Keep the line above the call that says what the script returns and when to run it. The usage comment lives in the script header. The trigger lives in the skill.
- A shell function dies with the tool call. A script survives, so extracting one deletes the warning the function needed.
- The same path in `allowed-tools` runs the script with no permission prompt: `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/<name>.sh *)`.

```
Worked: issue-queue held map_tickets() and orphan_issues(), 18 lines of GraphQL.

  ->  scripts/queue-list.sh [--map <n>]     one script, one flag
      SKILL.md  -26 lines, and the line "paste the function into the
      Monitor command" went out with them
```

Run the script once before you write the line that calls it. An untested script fails in a session you are not watching.

## Invocation

A skill fires one of two ways. Pick one before you write the description.

| | Model-invoked | User-invoked |
|---|---|---|
| Fires on | the agent reading the description, or you typing the name | you typing the name |
| Frontmatter | omit `disable-model-invocation`. Write the trigger description | `disable-model-invocation: true`. The description drops to a one-line human summary |
| Context cost | the description sits in context on every turn | none |
| Reach | another skill can invoke it | you are the only caller |

- Model-invoke a skill when the agent has to reach it on its own, or another skill has to. Everything else is user-invoked and costs nothing.
- Two user-invoked skills cannot reach each other. Neither holds a description, so neither can fire the other. Put the shared reference in a plain file and point both at it.
- Split a model-invoked skill out of a larger one when it owns a distinct leading word, a word you already type. That word buys the always-loaded description.
- A task skill whose body is the whole prompt can run as its own worker: `context: fork`. A guideline skill has no task to run.

Read `references/skill.md` for the rest of the frontmatter, the substitutions, and `!` injection. Use when the skill needs an argument, a tool grant, a fork, or a path scope.

## Descriptions

A trigger, not a summary. It sits in context on every turn.

```
<what it does>. Use when <trigger>. [Not for <near miss>.]
```

Three sentences. 30 words. Under budget beats complete. Write the `Not for` clause only for a near miss you can name, one that has already pulled the wrong skill.

```
50 words:  Drive the agent-browser CLI the house way - one isolated session
           per task, auth state in .agent-auth/, evidence under
           .agent-evidence/<task>/. Use when verifying a web UI change,
           capturing before and after screenshots, or investigating...
23 words:  Drive a browser and capture evidence. Use when verifying a web UI
           change in the running app. Not for the agent-browser command
           reference.
```

Four cuts get you there:

| Cut | Because |
|---|---|
| The paths, the flags, the file names | Sentence one says what it does, not how it works |
| Every trigger that fires on the same case | Three is plenty. Five means you listed synonyms |
| The sentence that sells the skill | `The check comes before the code, never after` is body text |
| The vocabulary that lives only inside the skill | Write the words you would type |

A workflow summary in the description is the worst cut to miss. Claude follows the summary and never opens the body.

## CLAUDE.md

Always loaded, on every turn, in every session. The strictest budget you have.

| Write | Skip |
|---|---|
| The repo gotcha | Anything the file tree or the scripts already say |
| The convention that no file states | Anything Claude already does by default |
| The blast-radius line | Generic engineering advice |
| Who you are and how you work | A rule that repeats another rule |

Under 200 lines is the published limit. A procedure in `CLAUDE.md` is a skill that has not been cut yet. A rule that names a directory is a `.claude/rules/` file with `paths:`, loaded only when Claude opens a match. A rule with no `paths:` is a `CLAUDE.md` line in a second file.

## Verify

A document is not done when it reads well. It is done when it fires.

| You wrote | Check |
|---|---|
| a skill | a fresh session. Type the request as you would really type it. Do not name the skill. It fires |
| a hook | cause the event. Read what came back |
| a subagent | spawn it with the brief and nothing else. It returns the artifact, not a question |
| a script | run it once by hand, from a directory that is not the skill's |

Then let it run once, end to end. Any line that did not change the result was not needed.

If the skill did not fire, fix the description. The body is not the problem.
