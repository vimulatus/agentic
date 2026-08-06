# Glossary — Building Great Agents

The domain model for what makes a subagent great. An agent exists to move work into its own context **window**; the root virtue is that the window is _earned_, and every term below is a lever on it. This is the disclosed reference for [`writing-great-agents`](SKILL.md).

The terms are grouped by axis: **The Window** (what an agent is for, and the two costs of the wall), **Invocation** (how the agent is reached), **The Grant** (what capability it runs under), **The Prompt** (what steers it, given a cold start), and **The Return** (what crosses back). Each **failure mode** lives beside the lever that cures it, tagged _failure mode_.

Some levers are shared with [`writing-great-skills`](../writing-great-skills/SKILL.md) — a subagent's body is a system prompt, and steers like any skill body. Those are noted, not re-derived; look them up there.

**Bold terms** in any definition are themselves defined in this glossary unless marked as living in the skills glossary.

## The Window

What an agent is for, and the wall that both isolates it and costs you.

### Window

The isolated context the subagent runs in — a fresh window with its own history, its own **grant**, its own model, walled off from the main conversation. The one thing a **skill** cannot give you (a skill runs _in_ the main window), so the only thing that justifies reaching for an agent. The root virtue is that the window is _earned_: it pays back its two costs — **cold-start** going in, a lossy **return** coming out — through **context economy**, **background parallelism**, or **confinement**. The test for every design choice: does this help the window pay?

_Avoid_: agent, worker, sandbox, subprocess

### Cold-Start

The window's entry cost: the agent begins seeing none of your conversation — not the files already read, not the skills already run, not the reasoning so far — and must re-gather what it needs from the **brief**. What makes a task too small to isolate (**cold-start waste**) and what the **prompt** must defend against (**context blindness**). A **fork** is the exception that pays no cold-start: it inherits the whole conversation instead of starting fresh.

_Avoid_: warm-up, ramp-up, startup cost

### Context Economy

The window used to keep the main conversation clean: verbose, single-use output (test runs, logs, doc fetches, wide searches) stays behind the wall, and only the distilled **return** crosses back. One of the three reasons a window is earned. Its defeat is a **raw return**, which lets the mess cross back anyway.

_Avoid_: context management, context saving, decluttering

### Background Parallelism

The window used for concurrency: independent work runs in its own window while the main conversation continues, rather than blocking it. One of the three reasons a window is earned. Works best when the parallel paths don't depend on each other; each agent's **return** still crosses back into the main window, so many fat returns re-flood it.

_Avoid_: async, concurrency, multitasking

### Confinement

The window used for safety and focus: a task that should run under a tighter **grant** than the main session — fewer tools, a locked permission mode — gets its own window so those limits bind only it. One of the three reasons a window is earned. The positive form of **least privilege**, applied as a _reason to spawn_ rather than a dial on the grant.

_Avoid_: sandboxing, restriction, lockdown

### Cold-Start Waste

_Failure mode._ A **window** spawned for a task too small to earn it, so the **cold-start** re-gathering costs more than isolating the task ever saved. The signal: the agent spends most of its run reconstructing context the main conversation already held. Cure: do the task inline.

_Avoid_: over-delegation, premature isolation

### Skill in Agent's Clothing

_Failure mode._ Reaching for an agent when the only draw is specialised knowledge, which needs no **window** — a **skill** delivers knowledge _in_ the main context, and can be `skills:`-preloaded into any agent that needs it. You pay **cold-start** and a lossy **return** for a benefit the window was never providing. Cure: write the skill; preload it where wanted. The tell that separates the two tools: if you don't need the wall, you don't need the agent.

_Avoid_: misuse, wrong-tool

## Invocation

How the agent is reached. The lever is shared with skills; the modes are agent-specific.

### Description

The agent's machine-readable trigger, and what Claude reads to decide whether to delegate — its _wording_, not the body, does the invocation work. Same lever as the skills **description** (see the skills glossary): **front-load the leading word**, state _when_ to delegate rather than what the agent is, and word it with the language you actually use when you want this work. Adding "use proactively" invites autonomous delegation.

_Avoid_: trigger, summary, frontmatter

### Delegation

The act of handing a task across the wall into a **window**. Automatic when Claude matches your request to a **description**; forced by hand three ways that escalate in strength — **name** the agent (Claude decides), **@-mention** it (guarantees it runs for one task), or run the **whole session as it** via `--agent` or the `agent` setting (the main thread takes its prompt, grant, and model). The verb whose object is the window: you delegate _across_ the wall, and the wall is what the window is.

_Avoid_: dispatch, hand-off, routing

## The Grant

The capability an agent runs under, and the discipline that sizes it.

### Grant

The bundle of capability a **window** runs under — its tools, its model, its permission mode. Sized by **least privilege**; oversized, it is **over-grant**. Three dials: **tools** (allowlist with `tools:`, subtract with `disallowedTools:`, inherit everything if both are omitted), **model** (right-sized to whether the **return** needs judgement), and **permissions** (`permissionMode` wholesale, or a `PreToolUse` hook to confine a single tool finer than an allowlist can).

_Avoid_: capabilities, permissions, access

### Least Privilege

The discipline that sizes the **grant**: give the job the tools, model reach, and permissions it needs and nothing more. A narrower grant is safer and keeps the agent focused on the task instead of wandering into capability it shouldn't use. The same instinct as **confinement**, but applied as a dial on an agent you've already decided to spawn rather than as a reason to spawn one. Its violation is **over-grant**.

_Avoid_: minimal permissions, sandboxing, scoping

### Over-Grant

_Failure mode._ A **grant** wider than the job needs — every tool inherited when three would do, an expensive model on mechanical work, loose permissions on a read-only task. Costs safety (more surface to misuse) and focus (the agent reaches for capability the task never called for). Cure: pare tools to the task, right-size the model, tighten the permission mode.

_Avoid_: over-provisioning, privilege creep

## The Prompt

What steers the agent, and how a cold start shapes it.

### Prompt

The agent's system prompt — the markdown body of its definition file — and the durable half of what crosses into the **window**, re-applied on every run. Distinct from the **brief**, the transient half Claude writes fresh per invocation. Steered with the same levers as any skill body — **leading words**, checkable **completion criteria** — and pruned the same way, cutting **no-ops** (all in the skills glossary). Its agent-specific burden is that the window starts **cold**, so it must carry its own **orientation** and assume no shared history.

_Avoid_: system prompt, body, instructions

### Brief

The delegation prompt Claude composes when it hands work across the wall — the transient half of what crosses into the **window**, written fresh each invocation, where the **prompt** is the durable half. All the agent gets of your intent, since **cold-start** denies it the conversation itself. You shape the brief indirectly, through what you ask Claude when you delegate; you shape the **prompt** directly.

_Avoid_: task message, delegation prompt, request

### Orientation

The opening move a **prompt** gives a **cold** agent: how to gather its own context before acting ("run `git diff`, read the modified files, then begin"). The defence against **context blindness** — it replaces the history the window can't see with instructions to reconstruct what matters. A well-oriented agent is self-sufficient from a thin **brief**.

_Avoid_: setup, priming, bootstrapping

### Context Blindness

_Failure mode._ A **prompt** that assumes knowledge the **cold** window can't see — referencing "the file we changed," a decision made earlier in the conversation, a variable the main thread held. The agent, starting fresh, has none of it, and either guesses or stalls. Cure: **orientation** — tell the agent how to find what it needs rather than assuming it arrives knowing.

_Avoid_: context assumption, stale reference

## The Return

What crosses back, and the whole reason the wall has an outward edge.

### Return

The agent's summary that crosses back into the main **window** — its whole product, since everything else it did stays behind the wall. A great agent is designed backward from it: the **prompt** names _what_ to return and _in what shape_ (the failing tests with messages, not the log; the root cause and fix, not the transcript). The outward edge of the wall, as the **brief** is the inward edge. Undone by a **raw return**.

_Avoid_: output, result, summary, response

### Raw Return

_Failure mode._ An agent that hands its working context back — full logs, every file read, the whole transcript — instead of a distilled **return**, re-flooding the main **window** and defeating the **context economy** that justified spawning it. Compounds under **background parallelism**: many agents each returning fat results flood the context faster than one. Cure: specify the return's content and shape in the **prompt**, so the wall passes a summary, not a dump.

_Avoid_: output dump, verbose result, context leak
