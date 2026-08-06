---
name: writing-great-agents
description: Reference for writing and editing subagents well — the vocabulary and principles that make an agent earn its window.
disable-model-invocation: true
---

A subagent exists to move work into its own context **window** — a fresh window in, a distilled **return** out. That window is the one thing a **skill** can't give you, so it is the only thing that justifies reaching for an agent. Every lever below serves making the window pay.

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md); look them up there for the full meaning. The mechanics of every frontmatter field live in the [subagents docs](https://code.claude.com/docs/en/sub-agents.md) — this skill is the principles, not the field table.

## When a task earns a window

The window costs twice, once at each edge. Going in, the agent sees none of your conversation — it starts **cold** and re-gathers what it needs from a short **brief**. Coming out, only its summary crosses back, so the **return** is lossy. Pay that toll only when the window buys something back:

- **Context economy** — the task floods a context with output you won't reference again (test runs, logs, doc fetches, wide searches). The mess stays behind the window; only the **return** crosses.
- **Background parallelism** — independent work runs in its own window while the main conversation keeps going.
- **Confinement** — the task should run under a tighter **grant** than the main session — fewer tools, a locked permission mode.

If the only draw is specialised knowledge, the task needs no window — that is a **skill**'s job. Write the skill and `skills:`-preload it into whatever agents need it. Reaching for an agent there is **skill in agent's clothing**: you pay cold-start and a lossy return for nothing. And a window too small to fill is **cold-start waste** — the re-gathering costs more than isolating the task ever saved.

## Invocation

Shared with skills: the **description** is the agent's machine-readable trigger, and its wording — not the body — decides whether Claude delegates. **Front-load the leading word** and state _when_ to delegate, not what the agent is ("Use proactively after code changes…"); "proactively" invites autonomous delegation.

Three ways to reach an agent by hand escalate in force: **name it** in your prompt and Claude decides; **@-mention** it to guarantee it runs for one task; run the **whole session as it** with `--agent` or the `agent` setting, so the main thread takes its prompt, grant, and model.

## The grant

Every agent runs under a **grant** — its tools, model, and permissions — and the discipline is **least privilege**: give the job what it needs and nothing more. A narrower grant is safer and keeps the agent focused; the failure is **over-grant**. Three dials:

- **Tools** — allowlist with `tools:` or subtract with `disallowedTools:` (omit both and it inherits everything). A read-only reviewer denies Write and Edit; a researcher keeps Read, Grep, Glob.
- **Model** — right-size it. A cheap model (`haiku`) for high-volume mechanical work whose **return** needs no judgement (search, log-scraping); a stronger one where it does. Defaults to `inherit`.
- **Permissions** — `permissionMode` tightens or loosens prompts wholesale; a `PreToolUse` hook confines a single tool finer than an allowlist can (e.g. read-only SQL through `Bash`).

## The prompt

The body is the agent's system prompt — the durable half of what crosses in, re-applied every run, where the **brief** is the transient half Claude writes per invocation. Because the window starts **cold**, the prompt must assume nothing the main conversation knew; assuming it is **context blindness**. Defend against it with **orientation**: open the prompt with how to gather context first ("run `git diff`, read the modified files, then begin"). Past that, steer the body with the same levers as a skill — **leading words**, checkable **completion criteria** — and prune it the same way, cutting **no-ops**.

## The return

The **return** is the agent's whole product: only its final summary crosses back into the main **window**, so design the agent backward from it. Say in the prompt _what_ to return and _in what shape_ — the failing tests with their messages, not the whole test log; the root cause and the fix, not the transcript of reaching them. The failure is a **raw return**: the agent hands its working context back and defeats the context economy that justified the window in the first place. Many agents each returning a fat result re-floods the very context you isolated.

## Failure modes

Use these to diagnose an agent that isn't paying off.

- **Cold-start waste** — a window spawned for a task too small to earn it; re-gathering context costs more than isolation saved. Fix: do it inline.
- **Skill in agent's clothing** — an agent reached for pure specialised knowledge that needs no window. Fix: make it a **skill** and preload it.
- **Raw return** — the agent dumps its working context back instead of a distilled **return**, re-flooding the main window. Fix: specify the return's content and shape in the prompt.
- **Over-grant** — a wider **grant** than the job needs, costing focus and safety. Fix: pare tools to the task and right-size the model.
- **Context blindness** — the prompt assumes history the **cold** window can't see. Fix: add **orientation** so the agent gathers its own context.
