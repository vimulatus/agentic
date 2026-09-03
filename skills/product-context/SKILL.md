---
name: product-context
description: Put the product, its users, its stage, and how to run, gate and ship it into CLAUDE.md. Use when a CLAUDE.md lacks a Product or Ship section, or a session contradicts one.
---

# Product context

The code says what the product does. It never says who it is for, where it is going, or what you must not build. That goes in the project's `CLAUDE.md`, so it loads on every turn.

```markdown
## Product

<one line: what it does, and for whom>

**Stage:** <where it is, in Vasu's words>

- **Users** — who they are, and what they use today instead of this
- **Works when** — the outcome that means it worked
- **Non-goals** — what we will not build, and why
```

Under it, the three commands every session rebuilds by hand. Vasu typed "How do I deploy this?" in eight sessions of one project.

```markdown
## Ship

- **Run** — the command that starts the app, and the port it takes
- **Gate** — the command that must pass before a push
- **Ship** — how a change reaches users: the tag, the workflow, the manual step
```

A line the repo's scripts already state word for word does not go in. A line that names a port, a scope, a tag shape, or a manual click does.

The stage is the strongest line in the section. A throwaway spike and a system on call earn opposite defaults, and you already know which is which.

Name a rival only where it changes a build decision: users who come from Notion expect Notion's shortcuts. A table of competitors changes nothing you type.

A line that changes no build decision does not go in the section.

## Grill for it

Read the README, the manifest, the routes, the models and the landing copy first. Draft every line the repo can answer.

Load `grilling` for what is left.

Mark a line you guessed with a leading `?`. Drop the `?` when a session proves it.

## Edit it the moment it goes stale

Every session that contradicts the section rewrites it, in that session, before you report the work done.

| What you learn | What you change |
|---|---|
| A user you had not heard of | `Users` |
| A feature Vasu killed | `Non-goals`, and say why |
| A spike that people now depend on | `Stage`, and raise your rigor to match |
| Anything that proves a `?` line | Drop the `?` |

Then say which line you changed.
