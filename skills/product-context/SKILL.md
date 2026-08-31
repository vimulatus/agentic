---
name: product-context
description: Put the product, its users and its stage into CLAUDE.md. Use before you write or edit a `## Product` section, when you set up or initialise a repo's CLAUDE.md, when a repo's CLAUDE.md has no Product section, or when a session teaches you something that section does not say.
---

# Product context

The code says what the product does. It never says who it is for, where it is going, or what you must not build. That goes in the project's `CLAUDE.md`, so it loads on every turn.

```markdown
## Product

<one line: what it does, and for whom>

**Stage:** <where it is, in his words>

- **Users** — who they are, and what they use today instead of this
- **Works when** — the outcome that means it worked
- **Non-goals** — what we will not build, and why
```

The stage is the strongest line in the section. A throwaway spike and a system on call earn opposite defaults, and you already know which is which.

Name a rival only where it changes a build decision: users who come from Notion expect Notion's shortcuts. A table of competitors changes nothing you type.

A line that changes no build decision does not go in the section.

## Grill for it

Facts are your job, decisions are his. Read the README, the manifest, the routes, the models and the landing copy first. Draft every line the repo can answer.

Then ask, in one round, only what is left. Number each question and give your recommended answer, so he answers by exception.

```
❓ **Q1 — <title>**: <question>
➡️ <your recommended answer>
```

His answers open the next round. Stop when nothing is left assumed.

Mark a line you guessed with a leading `?`. Drop the `?` when a session proves it.

## Edit it the moment it goes stale

Every session that contradicts the section rewrites it, in that session, before you report the work done.

| What you learn | What you change |
|---|---|
| A user you had not heard of | `Users` |
| A feature he killed | `Non-goals`, and say why |
| A spike that people now depend on | `Stage`, and raise your rigor to match |
| Anything that proves a `?` line | Drop the `?` |

Then say which line you changed.
