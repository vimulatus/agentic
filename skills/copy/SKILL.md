---
name: copy
description: "Write the strings an end user reads: UI labels, empty states, errors, help pages, guides. Use whenever you write or change one. Not for code."
---

# Copy

The user came to finish a task. Give them the **What** and get out of the way.

| Word | It says | It ships |
|---|---|---|
| **What** | the thing, the state, the next action | always |
| **Why** | the reason it is that way | only when it changes what they do next |
| **How** | the mechanism under it | never |

## Name the reader first

Read the `## Product` section of the project's `CLAUDE.md`. It names who is on the screen.

Then, for the string in your hand:

```
reader   <who opens this screen>
does     <what they do differently for having read it>
verdict  ship | cut
```

`does nothing differently` is a cut. Every time.

## The Why

You settle something while you build. Then you ship the reasoning as a caption. The reader was not in the room, and does not need to be. Ship the conclusion.

```
Shipped   "The share of a day's generations that did not finish. A day on
           which gen was never called has no share at all, so the line breaks
           across it and the readout gives the same em dash the provider
           table gives."

reader    whoever opens the dashboard
does      nothing differently. The heading and the chart already said it
verdict   cut. How you handled empty days belongs in the code

Ships     the heading, and the em dash on days that never ran
```

The Why earns its place in three cases, and no others:

| Case | Worked |
|---|---|
| The reader is blocked and the reason names the unblock | "Entries can't be posted into a filed period. Reopen the period, or post to the next one." |
| The reader will assume the app is broken | "Your upload is still processing. The link works once it finishes." |
| The reader is about to lose something | "Deleting the workspace deletes its 412 files. This cannot be undone." |

In all three the reason is really a What: what to do, what is happening, what goes away.

## The How

Your stack is not the reader's business. Name the thing they see, never the thing you built.

```
Shipped   "Files are served from an R2 bucket behind a Cloudflare Worker,
           which signs the request and proxies it to your custom domain."
Ships     "Upload a file. You get a link on your own domain."

Shipped   "Prefixes scope the tenant, and the policy engine resolves the
           bucket binding against the org slug before..."
Ships     "Add a prefix if you want to group files."

Shipped   an invoice list showing a `superseded` row
Ships     the invoice, updated. Cancel and re-enter is internal
```

- The word on the screen, never the word in the schema. `tenant` in the DB is "workspace" to the reader.
- A vendor name, a table name, a queue, a flag, a version number: internal, unless the reader must type it.
- An error names what failed for the reader, not the layer that threw.

## How it reads

| Tell | Fix |
|---|---|
| An em dash, an en dash, or a hyphen used as a dash | A period or a comma |
| "not just X, but Y" | State Y |
| crucial, robust, seamless, comprehensive, delve, leverage, utilize, additionally, ensure, showcase, underscore, landscape | The plain word |
| "serves as", "stands as", "boasts", "features" | "is", "has" |
| Three items where the real number is two or four | The real number |
| "in order to", "it is important to note that", "due to the fact that" | "to", nothing, "because" |
| `**Performance:** Performance improved...` | Prose |
| Title Case Headings | Sentence case |
| Decorative emoji, curly quotes | Delete them, straight quotes |
| "could potentially possibly" | "may" |
| "The future looks bright" | The next concrete step, or stop |

- Second person, present tense, imperative: "Open **Settings**".
- Passive voice hides the actor. "queries are validated" becomes "the compiler validates queries".
- Precision does not save a line. A sentence that fits any other project says nothing about this one, and a sentence that fits nowhere else can still change nothing. Both go.

## Surfaces

| Surface | The What is |
|---|---|
| Button, menu item, tab | the action, one or two words |
| Empty state | what goes here, and the one action that puts it there |
| Error, toast | what happened, then what the reader does |
| Tooltip, help popover | what this control does |
| Guide, help page | the steps, in order, one action per step, the label as the app shows it |
| Public package docs, README | what it does, then the first command that works |
| Release note | what changed for the reader |

## Done

- Every string names what the reader sees or does.
- No string names a vendor, a table, a layer or a flag the reader never types.
- Every surviving Why sits on a block, a surprise, or a loss.
