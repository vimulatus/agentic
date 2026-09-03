---
name: research
description: Answer from primary sources - docs, source, specs - inline or as a report. Use when Vasu wants a topic researched, docs read, or a library or vendor claim checked.
---

# Research

| The question | Mode |
|---|---|
| one fact: does v1.7 do X, what does this endpoint return, what does this box cost | **Check**. Answer now, in chat, with the source next to the claim |
| a topic: prior art, a design space, a migration path | **Report**. A subagent reads while you keep working |

## Check

Read the source at the version in use. The `coding` skill carries the clone command. A vendor's price or product list: their page, today. Say what you read and where.

## Report

Spawn a `general-purpose` subagent with the Agent tool. Its brief:

1. Investigate the question against **primary sources**: official docs, source code, specs, first-party APIs. Follow every claim back to the source that owns it.
2. Write the findings to one Markdown file, with each claim's source next to it. Under 300 lines: the answer first, the evidence under it, and a worked example where the reader has to see it to believe it.
3. Save it where the repo keeps such notes. No convention: `docs/research/<topic>.md`, and say so.

Vasu on an 1,800-line report: "I am struggling to understand all this text." The file is for him to read, not for you to have written.
