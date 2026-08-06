---
name: documentation
description: How to write and maintain project documentation an agent (or human) can actually orient with — a glossary, an ADR log, a component catalog. Use when writing or maintaining any project documentation surface, capturing decisions or terminology, or reviewing an existing doc against these principles.
---

# Documentation

Documentation exists so a reader can **orient before acting** and then **drill into detail without loss**. Every surface below serves those two jobs. The reader is usually an agent about to do a task, but the same principles serve a human — audience is a property of a surface, not the organizing idea.

## Principles

Apply these to every surface, whatever its shape.

- **Two layers.** Each surface has a *breadth* index you read to orient — the single, cheap-to-read entry point — and *depth* docs you drill into on demand. Breadth links down into depth.
- **Non-derivable semantic layer only.** Hold what a reader *can't* recover by reading the code: a thing's **role**, when to reach for it (and when not), how it **relates** to its neighbours, the **rationale** behind it, and **pointers** to where it lives. Never mirror what `grep` already answers — prop lists, file trees, dependency versions. Anything derivable goes stale and then lies with authority; leave it to be re-derived.
- **Canonical and opinionated.** One name per concept. When several words exist, pick the best and list the rest as aliases to avoid.
- **Split lazily, along the natural semantic axis.** A breadth index stays a single flat file while it's cheap to read. When it outgrows a cheap read, split it and leave a thin **map** on top that routes to the pieces. The axis is *semantic* — never physical layout, which may or may not coincide. Each surface names its own axis (see the guides). Never pre-split.
- **Lazy creation.** Create a file only when you have something to write into it.
- **Capture inline, as it crystallises.** When a term is pinned down or a decision is made, record it right then — don't batch. Cross-reference against the code as you go; when the doc and the code disagree, surface it.
- **Definition of done.** A change isn't finished until the docs it touched are updated. A stale doc is worse than none.

## Surfaces

Load the guide for the surface you're working on:

| Surface | What it captures | Guide |
|---|---|---|
| Domain | The project's ubiquitous language — a glossary, per-concept models, and the pending ledger | [surfaces/domain.md](surfaces/domain.md) |
| Glossary | The codebase's architecture and infrastructure vocabulary | [surfaces/glossary.md](surfaces/glossary.md) |
| Decisions | Architectural decisions and *why* they were made (ADRs) | [surfaces/decisions.md](surfaces/decisions.md) |
| Components | A catalog of UI components and their roles, linking to per-component docs | [surfaces/components.md](surfaces/components.md) |

When reviewing an existing doc, read it against these principles and its surface guide: name each part that's missing, thin, stale, or mirroring the code instead of capturing the semantic layer.
