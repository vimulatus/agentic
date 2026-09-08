---
name: context-engineering
description: Pick the home and write the lines - project instructions, rule, skill, script, hook or subagent. Use before you add or edit one, when a skill does not fire, or when one runs long.
---

# Context engineering

Keep the workflow and Vasu's preferences shared. Before writing client mechanics, read only the target client's reference: [Claude Code](references/claude.md) or [Codex](references/codex.md). For changes shared by both clients, check both.

Tool names, configuration fields, instruction-file locations and lifecycle assumptions belong in those references. A workflow points to the applicable reference at the step that needs it. Optional tools branch on availability; each required step has a supported way to finish.

A document holds the opinions the agent cannot derive: your commands, your house choices, your taste. The agent supplies the rest.

Keep instructions concise without losing audience, constraints or reasons that improve decisions.

## Three verbs

Distinguish instructions made available to the agent, skills selected for a task, and executable automation. Their costs and guarantees depend on the client.

| Verb | When | Costs | Guarantee |
|---|---|---|---|
| **loaded** | when the client includes applicable instructions | instruction context | available to the agent; compliance is not enforced |
| **fires** | when a skill is selected or explicitly invoked | discovery metadata, then the body | supplies guidance for the task |
| **runs** | when a supported hook event occurs, or a script is called | execution and any returned context | executes code, subject to registration, trust and permissions |

A loaded line is a request. A fired line is a request that waits. A registered, enabled and trusted hook runs at its supported event; verify those conditions in each client.

## The home

One home per line. Pick it by the trigger, before you write.

| The line | Home | Verb |
|---|---|---|
| must happen every time, and needs no judgment | a **hook** | runs |
| a command the agent repeats verbatim | a **script** the skill calls | runs |
| a fact every session needs | the client's **project instruction file** | loaded |
| a fact only some files need | **scoped instructions**, using the client's supported mechanism | loaded on the match |
| a procedure with judgment in it | a **skill** | fires |
| detail only some runs of a skill reach | a **reference** the skill points at | fires on the pointer |
| a read that would flood the context, or a worker with fixed instructions | a **subagent** | fires |
| a connection to an outside system | an MCP server | tool discovery and calls, as supported by the client |

Use a hook for a deterministic action or restriction only when the client supports the event and enforcement needed. Returning instructions from a hook does not guarantee the agent follows them.

A line that wants two homes is two lines.

Read [references/hook.md](references/hook.md) when writing a hook handler, and [references/subagent.md](references/subagent.md) when writing a worker's brief. Registration and runtime contracts belong in the target client's reference.

## Write only what the agent cannot derive

Keep lines that change a decision: commands and flags that are not readily discoverable, house choices, hidden gotchas, and standards that guide judgment. Omit generic advice and facts already available from the relevant configuration or tool help.

Where you hold no opinion, write nothing. A rule invented to fill a gap is a rule the agent has to fight.

## Prompt smells

When creating or editing agent documents, look for these smells in the draft and the existing instructions it will join. Older prompts often carry scaffolding that duplicates native reasoning and spends tokens without changing the outcome.

| Smell | Action |
|---|---|
| Verification rituals: "double-check your work", "verify twice before responding" | Remove generic reassurance and repeated checks. Keep checks tied to an observable result, such as a test command or acceptance criterion |
| Mandatory procedures and scratchpads: "think step by step", fixed reasoning templates | Remove prescribed thinking steps and scratchpad scaffolds. State the outcome and constraints; keep an ordered procedure only when a real dependency or operational risk requires that order |
| Stale examples and few-shot scaffolding | Default to no examples. Remove examples that merely rehearse behavior the model already knows; retain only current examples that resolve a specific ambiguity or define a required format |
| Contradictory rules within or across applicable documents | Identify the conflicting lines and their sources. Apply explicit instruction precedence and decisions Vasu has already made; bring unresolved choices to Vasu using the grilling skill |
| Pressure language or hedged requirements | State requirements plainly; reserve emphasis for demonstrated routing failures |
| Output micromanagement: word ceilings, update cadences, formatting bans | Describe the reader's needs; preserve actual interface limits |
| Incident patches and migration narratives | Trace their purpose; express current rules and retire obsolete workarounds |
| Grader language | State the requirement being evaluated |
| Prompt scaffolds replacing supported API features | Check current capabilities; prefer schemas and configuration where appropriate |

Base removals on the target model and runtime, using history or current documentation. Old-looking wording alone warrants a flag, not deletion. Preserve protections against demonstrated failures. A clean audit can produce no changes.

For unresolved contradictions, show the competing instructions, explain how each changes behavior, and recommend a choice. Grill Vasu until the choice is settled; leave the disputed rule unchanged while continuing independent edits. Record the answer in its owning document and reconcile conflicting copies within scope.

## Language

State the opinion directly. Include its reason when that reason helps choose between alternatives.

Use familiar, consistent vocabulary for concepts shared across prompts, documents and code. Define terms when their meaning is ambiguous; prefer concrete requirements over intensity words or slogans.

## Form

Choose prose, tables or code blocks for readability. Use headings to separate branches that readers need to find independently.

- Prefer the desired behavior when it makes the instruction clearer. Keep explicit prohibitions when they define a real boundary.
- Keep a concept whole. Its definition, its rules and its caveats sit under one heading. A reader who lands on one part gets the neighbors free.
- Define completion through observable results or acceptance criteria.
- Write standing instructions that remain useful throughout the task, including after context compaction.

## Layers

Keep common guidance in the body, conditional detail in references, and executable automation in scripts.

```
<skill>/
├── SKILL.md                guidance shared across uses
├── references/<topic>.md   detail loaded when relevant
└── scripts/<name>.sh       automation called when needed
```

The description supports discovery before the body is loaded; its availability depends on the client and invocation policy.

Branching is the test. Inline what every branch needs. Move out what only some branches reach.

| The file | Do |
|---|---|
| Every run needs all of it | Keep one file; remove redundancy without losing useful context |
| Only some runs reach a section | `references/<topic>.md`. Point at it |
| Completion depends on a later action | Keep that completion condition visible; move only its conditional mechanics |
| Stable logic can be executed without task-specific rewriting | `scripts/<name>.sh`; document its trigger and interface |

Give each reference pointer a clear trigger and purpose so required detail is discoverable. Prefer direct links from the entrypoint; avoid chains that obscure what a task needs.

Split by relevance rather than a fixed line ceiling. A long section needed only for one branch is a candidate for a reference.

## Scripts

Extract stable commands or repeated logic into scripts. Keep task-specific command shapes visible when the agent needs to adapt them; inspect script implementations when changing or diagnosing them.

Resolve the skill's directory from the loaded `SKILL.md` path, then use an absolute script path. A reference uses its owning skill's directory, not the reference directory. State that directory beside examples so a reader can substitute it; shell working directories can change.

```
"<skill-dir>/scripts/<name>.sh" --flag <arg>
```

Distinguish running a script from reading its implementation. Describe what the call returns and when to use it.

- Share closely related script logic when a flag keeps the interface clear.
- Keep script usage details in its header and the task trigger in the skill.
- Use a script when commands must survive across separate shell sessions; do not assume session-local functions persist.
- Tool grants and variable substitutions are client configuration; use the target client's reference.

## Invocation

Preserve the existing invocation policy. New skills use automatic discovery unless Vasu requests an explicit-only entrypoint; configure the chosen policy for each client.

| | Model-invoked | User-invoked |
|---|---|---|
| Fires on | the agent reading the description, or you typing the name | you typing the name |
| Configuration | Write the trigger description; retain automatic discovery | Use the client's invocation policy; keep a one-line human summary |
| Context cost | discovery metadata is available before the body | depends on the client; keep metadata short |
| Reach | another skill can invoke it | you are the only caller |

- When entrypoints share a procedure, point both at one plain reference. Do not rely on discovery of an explicitly invoked skill to load that procedure.
- Split a skill when it serves a distinct task with a recognizable trigger, not just a different name for the same workflow.
- Give workers a concrete task and the relevant skill guidance. Use the client's supported delegation mechanism.

Read the target client's reference when the skill needs arguments, tool grants, a worker, or a path scope. Shared bodies never assume those features transfer between clients.

## Descriptions

Tool descriptions are contracts: include parameter meaning, limits, failures and omitted results. Keep conversational steering in the workflow. Skill descriptions route; tool descriptions explain execution.

A skill description should identify the capability and the requests that need it. Use words Vasu would type, distinguish nearby skills when misrouting is plausible, and put execution details in the body. Keep it concise without a fixed word or sentence count; preserve the information needed to select the right skill.

## Project instructions

Loaded by the client for the applicable project or directory. The strictest budget you have.

| Write | Skip |
|---|---|
| The repo gotcha | Anything the file tree or the scripts already say |
| The convention that no file states | Anything the agent already does by default |
| The blast-radius line | Generic engineering advice |
| Who you are and how you work | A rule that repeats another rule |

Keep project instructions short. A procedure in them is a skill that has not been cut yet. Scope directory-specific facts using the target client's mechanism; a second unscoped file still costs context.

## Verify

Validate the behavior affected by the change. State what was observed and what remains untested.

| You wrote | Check |
|---|---|
| an automatically discovered skill | a fresh session with an ordinary request that should select it; observe both selection and execution |
| an explicitly invoked skill | invoke it as the user would and observe the result |
| a hook | cause the event. Read what came back |
| a subagent | provide the brief and required inputs; observe whether it completes the task or identifies a real missing dependency |
| a script | run it once by hand, from a directory that is not the skill's |

Use the relevant check to observe the intended behavior. Repeat only when a change, failure or unresolved uncertainty calls for it.

For prompt cleanup that changes behavior, compare representative requests before and after when practical. Measure tokens and latency when making efficiency claims, alongside quality. Trace removed mechanisms through callers and tests within scope.

If a skill is not selected, check discovery, invocation policy and description before rewriting its body. If it is selected but behaves incorrectly, inspect the guidance and required resources.
