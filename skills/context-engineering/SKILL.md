---
name: context-engineering
description: Write and prune the documents Claude reads - SKILL.md, CLAUDE.md, rule files. Use before you add or edit one, when a skill does not fire, or when one runs long.
---

# Context engineering

A document holds the opinions Claude cannot derive: your commands, your house choices, your taste. Claude supplies the rest.

Write less than feels safe.

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

## No prose

State the opinion. Stop. Claude does not need the paragraph around it.

```
Rambling:
Because prototypes get thrown away, and because build tooling adds
setup cost that rarely pays off this early, it is usually better to
keep everything in one file and lean on plain CSS instead of...

Opinion:
- One HTML file. Plain CSS. No build step.
```

Give the reason only when the reason decides a fork. Otherwise the bullet is the whole instruction.

## Leading words

A **leading word** is one word that carries a whole behavior, because the model already holds its meaning. Repeat the word. Never re-explain it.

| Spelled out | Leading word |
|---|---|
| "fast, deterministic, low-overhead" | a **tight** loop |
| "a failing test you trust to catch this exact bug" | the loop goes **red** |
| "how far a mistake here can spread" | **blast radius** |

You win twice: fewer words, and one hook Claude hangs the behavior on.

- Reach for a word the model already knows. A coined word carries nothing, so you pay in definition what a pretrained word gives free.
- Grade the word against the default. "Be thorough" loses to a model that is already thorough-ish. **Relentless** wins. A weak word is a wasted line.
- Use the same word in your prompts, your documents, and your code. Shared vocabulary is what makes a skill fire.

Hunt for the passage that collapses into one word. Most documents carry several.

## Invocation

A skill fires one of two ways. Pick one before you write the description.

| | Model-invoked | User-invoked |
|---|---|---|
| Fires on | the agent reading the description, or you typing the name | you typing the name |
| Frontmatter | omit `disable-model-invocation`. Write the trigger description | `disable-model-invocation: true`. The description drops to a one-line human summary |
| Context cost | the description sits in context on every turn | none |
| Reach | another skill can invoke it | you are the only caller |

Model-invoke a skill when the agent has to reach it on its own, or another skill has to. Everything else is user-invoked and costs nothing.

Split a model-invoked skill out of a larger one when it owns a distinct leading word - a word you already type. That word buys the always-loaded description.

Two user-invoked skills cannot share reference through each other. Neither holds a description, so neither can fire the other. Put the shared reference in a plain file and point both at it.

When the user-invoked skills outgrow your memory, write one **router** skill that names them and says when to reach for each. One name to remember instead of many. A router hints. It cannot fire them.

## Descriptions

A trigger, not a summary. It sits in context on every turn.

```
<what it does>. Use when <trigger>. [Not for <near miss>.]
```

Three sentences. 30 words. Under budget beats complete.

```
Prose - 50 words, the real browser-evidence description:
  Drive the agent-browser CLI the house way - one isolated session
  per task, auth state in .agent-auth/, evidence under
  .agent-evidence/<task>/. Use when verifying a web UI change,
  capturing before and after screenshots, or investigating the
  running app in a browser. Not for the command reference, which
  ships with the CLI.

Focused - 23 words:
  Drive a browser and capture evidence. Use when verifying a web UI
  change in the running app. Not for the agent-browser command
  reference.
```

Four cuts get you there:

| Cut | Because |
|---|---|
| The paths, the flags, the file names | Sentence one says what it does, not how it works |
| Every trigger that fires on the same case | Three is plenty. Five means you listed synonyms |
| The sentence that sells the skill | `The check comes before the code, never after` is body text |
| The words that live inside the skill | Write the words you would type |

## Form

One heading per branch. A table or a code block per rule set. Prose only where both of those fail, and four lines at most.

- Prompt the positive. A prohibition puts the banned behavior into context and makes it more available, not less. Write "match the surrounding style", not "do not invent a new style".
- Keep a concept whole. Its definition, its rules and its caveats sit under one heading. A reader who lands on one part gets the neighbors free.
- State what done looks like when it is checkable. "Every changed model has a migration" drives more work than "update the migrations".

## Progressive disclosure

Branching is the test. Inline what every branch needs. Move out what only some branches reach.

| The file | Do |
|---|---|
| Every run reads all of it | Keep one file. When it runs long, cut lines |
| Only some runs reach a section | Move it to a sibling file. Point at it |
| A later step tempts Claude to call the job done early | Move the later step out. Out of view, it stops competing |

```
Worked: the prototype skill branches Logic and UI.
        Both branches publish      -> the publish command stays in-file.
        Only Logic draws a machine -> references/logic.md.
```

A pointer to a sibling file is a description too. The wording decides whether Claude opens the file. A must-have file behind a weak pointer is a variance bug: some runs open it, some do not.

```
See the reference file for more details.        <- Claude decides. It decides no.

Read references/logic.md for the state-machine  <- a trigger.
notation. Use when the prototype models a flow
or a backend state machine.
```

## CLAUDE.md

Always loaded, on every turn, in every session. The strictest budget you have.

| Write | Skip |
|---|---|
| The repo gotcha | Anything the file tree or the scripts already say |
| The convention that no file states | Anything Claude already does by default |
| The blast-radius line | Generic engineering advice |
| Who you are and how you work | A rule that repeats another rule |

## Verify

A skill is not done when it reads well. It is done when it fires.

1. Open a fresh session.
2. Type the request the way you would really type it. Do not name the skill.
3. Check that the skill fired.
4. Let it run once, end to end. Any line that did not change the result was not needed.

If the skill did not fire, fix the description. The body is not the problem.
