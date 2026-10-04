---
name: coding
description: How Vasu wants code written. Use whenever you write or edit code, and before you touch production or a live database.
---

# Coding

## Solve the class

**Solve the class, not the case.** From one example of a bug, fix every input in its class and name the class in one line. Generalize only to a class you can see in the code or the report, never to one you invent. When only the reported input reaches your fix, say so and say why.

**One correction is local.** When Vasu corrects you once, apply it here. Ask before you make it a standing rule.

**Shape first, style second.** After you read a file or a library, choose the shape this problem needs, then match the local style.

**Propose the bold idea.** When a redesign beyond the task would pay, build the task and put the redesign in the done report with what it buys. Build the redesign only on Vasu's yes, or when **Build the requirement in** applies.

## Module design

**Deep modules.** A small interface over substantial behavior, at a seam a test can drive through that interface. Split by responsibility, not line count; extracting helpers does not deepen a module. Optimize for a reader finding where a behavior lives.

**Design for the caller.** A library or an internal API serves the colleague who calls it and the engineer who maintains it next. Write the call site first, and shape the interface so that the call site reads plainly.

**A layer earns its place.** The house layers are the entry point (translates transport input and output), the Service (owns business rules and orchestration), the Repository (owns persistence) and injected dependencies. Build one only when it hides a decision that can change. A layer that would only forward its arguments is not built: the entry point calls the next layer that holds a decision. **Third-party providers** are the one exception.

## Changing code

**Delete before you add.** In the code the task touches, delete the dead code first: code with no caller (search every reference, including dynamic dispatch, config and tests), unused paths, and guards for a state the type or an earlier check already excludes. Then build on what is left. A deletion in the diff is not a destructive action under **Blast radius**; Vasu reviews it there.

**One decision, one place.** Each decision has a single source of truth. When a new value would thread through several layers (types, schemas, pipelines), stop and find the direct path: read the value where it is used, or decide once and pass the result.

```
Task: hide prices for guest users.
  threaded: isGuest checked in route, controller, service, view model, template     5 decisions
  once:     PricingService returns no prices for a guest; the template renders it   1 decision
```

**Build the requirement in.** When a requirement would add the same branch at many sites, build what you would have built had it been there from the start: make the violating state unrepresentable (**Make illegal states unrepresentable**), and carry it through types, docs, examples and tests. The repository takes a tenant, so no query runs without one; never `if (tenantId)` in 30 queries.

**Move every caller in the change that replaces the API.** Expand-contract inside one PR: add the new internal API, move every caller, delete the old one, one commit per step. A caller in this repo gets no compatibility layer.

**Short path, little state.** A reader answers "where does X come from?" and "what can change X?" without opening a pass-through layer. Inline a pass-through. Prefer a return value to a mutation, a local to a field, and a field to module state.

**Smallest change that solves the class.** Of the designs that satisfy the rules above, ship the one with the fewest decisions and touched sites. Smallest never means skipping a member of the class or a caller of the replaced API.

## Data and state

**Types before logic.** Before the logic, write the core types and the functions that read and write them, shaped for the most frequent read. A change to a stored shape (a column, a persisted document, a wire format) is a data-model call: name it in the done report, and ask first when it drops or rewrites stored data. In-memory types are yours.

**Make illegal states unrepresentable.** Each state is a variant of a discriminated union that carries only the fields true in that state: no field left over from an earlier state, no booleans that must agree. Parse stored and incoming data into the union at the boundary; an unknown variant throws there. One function takes a state and an event and returns the next state, rejecting each transition the lifecycle forbids. Match exhaustively, so a new variant fails the build (`never` in TypeScript). A rule that grows one branch per feature on the same key becomes a lookup table keyed by it.

```
{ shipped: boolean, shippedAt?: Date, cancelled: boolean }       shipped and cancelled can both be true
{ status: "cancelled", reason: string, shippedAt?: Date }         a field left from another state
{ status: "open" } | { status: "shipped", at: Date } | { status: "cancelled", reason: string }
cancel: open -> cancelled; shipped -> throws
```

**Brand what a swap would break.** When two values share a primitive but not a meaning, and meet in one signature or scope where swapping them compiles, give each its own type: `UserId` and `OrderId`, cents and dollars. One parse function mints each brand and holds its only `as`. A value with no such neighbour stays a primitive (**YAGNI**).

**Do not lie to the compiler.** No `as` outside `as const` and a brand's parse function, no non-null `!`, no `any`: parse or narrow instead. Derive a type from the schema that owns the shape (OpenAPI, a migration, protobuf), never a hand-copied parallel type.

**Functional core, imperative shell.** A business rule takes values and returns values: no I/O, clock or randomness inside it; pass `now` in. The Service reads, calls the rule, writes the result. The rule is a plain function in the Service's module, not a new layer. Test it with literal values, and drive the Service once through its interface for the wiring.

**Safe to rerun.** A job, script, migration, queue consumer, webhook handler, or any request a client retries, ends in the same state after one run, two runs, or a rerun after a crash halfway: an upsert or an idempotency key, not a bare insert; a check and its write in one transaction. Prove it on a disposable copy: run it twice, then kill it halfway and run it again.

**Separate before you lock.** When two actors could write the same file, key, branch or row, first give each its own, and merge where they are read. Add a lock, a queue or a single writer only when one shared target is the real invariant; the lock records its owner, so a rerun takes over from a dead one.

```
two workers write lastRun into state.json        a race
indexer-state.json + metrics-state.json          no shared write, no lock
```

## Comments

**Doc line, then silence.** A function, a class or an exported type gets one line above it that says how to use it: what it takes, returns and throws, never how it works. Inside a body, the code speaks.

**Outside constraints only.** A comment inside a body names a constraint from outside our code, a vendor bug, a protocol quirk or a platform limit, and links its issue. A comment that explains our own code is a bug report against the code: rename, extract or add a type until it says nothing new, then delete it. Legal and license headers stay. Keep every comment you touch true to the code.

**Cut on sight:** narration of the next statement, banners and section dividers, commented-out code, change history ("was X, now Y", "updated to handle Z"), a sermon defending a workaround.

**Read the rule before you suppress it.** Before `@ts-ignore`, `# type: ignore` or `eslint-disable`, read the rule. A style-only rule may be suppressed. A rule that catches real bugs: fix the code. When an outside constraint blocks the fix, the suppression links its issue; when anything else does, say so in your report, not in a comment.

## Slop

| Rule | Slop | Instead |
|---|---|---|
| **Fail fast** | `try`/`catch` around code with no known failure; a fallback that swallows the error and returns a default | Catch only the failure you can name and handle. Otherwise let it throw where the caller sees it |
| **Trust the type** | A guard for a state that cannot happen | Parse, don't validate: check untrusted input once at the boundary, then trust the type inside |
| **YAGNI** | An interface, factory, config object, parameter or flag that no current caller needs | Write the one thing. Add the option when its second caller arrives. Third-party providers are the exception |
| **Edit in place** | `processV2`, `enhanced_parse`, `SmartCache`, `parse_new` | Change the original |
| **Reuse first** | A hand-rolled copy of something the repo or the stdlib has | Search, then call it |
| **No ceremony** | `✅ Done!`, emoji log lines, progress banners; a new `SUMMARY.md` or `IMPLEMENTATION_NOTES.md` | The value, or nothing. The commit message carries the summary |

## Words

**Every string has a reader.** Comments, commit messages, log lines, error text and UI text keep what helps their reader understand the behavior or decide, and drop narration of your process. The `copy` skill's How it reads table applies to every string. Its What, Why and How filter applies only to strings an end user sees: a log line or a developer-facing error names the layer, the input and the value that failed.

## Unslop the diff

Before you report done, read the diff against Changing code, Comments, Slop and Words. Remove what adds no information or behavior.

When a rule in Changing code or Data and state changed what you built, the done report carries one line per rule: `<bold name>: <what it changed>`. When none did, add no line.

## Third-party providers

**Every vendor behind a provider.** Each third-party service or tool integration sits behind a provider interface, even with one implementation and one caller. It is a seam for replacement, coexistence and testing, and the house exception to **YAGNI** and **A layer earns its place**.

- **Contract:** the interface speaks application terms. Vendor SDK types, payloads and credentials stay inside the adapter (an anti-corruption layer); callers see application-owned inputs, results and errors.
- **Adapter:** owns every vendor HTTP or SDK call, authentication, serialization, response validation and transport failure handling.
- **Composition:** inject providers at the composition root, where selection and configuration live, so a replacement leaves business logic intact and two configured providers coexist without a global singleton.
- **Verification:** test features through the interface with injected fakes, and each adapter's mapping on its own. Adding a provider changes only adapter and wiring code, never feature code.

## Facts

A fact about a library, a vendor, or an environment comes from its source at the version in use, never from memory.

```bash
d=$(mktemp -d) && git clone -q --depth 1 --branch <tag> <repo> "$d"   # read, then rm -rf "$d"
```

Read the lockfile for the version first. A single file: `gh api repos/<owner>/<repo>/contents/<path>?ref=<tag>`.

## Blast radius

- Production, live databases, and daily-driver build or preview channels are off limits until Vasu names them. When a task sits next to one, name what you are about to touch, then wait for the yes.
- A destructive action Vasu did not ask for waits for the same yes. Destructive means it loses state the diff does not show: data, a branch, a remote, a deploy.
- A local database, a worktree, a temp dir: disposable. `docker compose down -v` and rebuild beats a hand-patched row. Do not ask.
- A spend is a trade-off Vasu prices. A model swap, a paid run, a bigger box: ask first.
