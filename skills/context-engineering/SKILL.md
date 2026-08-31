---
name: context-engineering
description: Write and prune the documents Claude reads - skills and CLAUDE.md. Use when creating or editing either, when a skill does not fire on its own, or when a document has grown long.
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
| The command and its flags: `postplan upload "$f" --draft <id>` | A step list for uploading a file |
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

## Descriptions

A description is a trigger, not a summary. It sits in context on every turn, so every word pays rent.

```
<what it does>. Use when <trigger>, <trigger>. [Not for <near miss>.]
```

- Use the words you would type. Not the words that live inside the skill.
- One trigger per distinct case. Two synonyms for one case are one trigger written twice.
- Add `Not for X` when a near neighbor would otherwise steal the invocation.

```
Helps with writing tests.                              <- a summary. It fires on nothing.

Write and run tests for changed code. Use when the     <- a trigger.
user asks for tests, or when a change lands with no
test covering it. Not for debugging a test that
already fails.
```

A pointer to a sibling file is the same shape. The wording decides whether Claude opens the file. The target does not. A must-have file behind a weak pointer is a variance bug: some runs open it, some do not.

```
See the reference file for more details.        <- Claude decides. It decides no.

Read references/logic.md for the state-machine  <- a trigger.
notation. Use when the prototype models a flow
or a backend state machine.
```

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
