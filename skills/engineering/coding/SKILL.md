---
name: coding
description: How Vasu wants code written, and the machine-written tells to cut - narrating comments, unearned abstraction, defensive scaffolding. Use whenever you write or edit code, on the diff before you report done, and before you touch production or a live database.
---

# Coding

- Propose the bold idea when it pays. Say what it buys.

## Solve the class

Solve the class, not the case. Generalize to the class in front of you, not to a class you invent.

| When | Do this |
|---|---|
| You have one example of the bug | Fix every input in that class. Name the class in one line. |
| Vasu corrects you once | Apply the correction here. Ask before you make it a standing rule. |
| You just read a file or a library | Choose the shape this problem needs, then match the local style. |

When only the reported input reaches your fix, say so and say why.

## Module design

Design deep modules: substantial behavior behind a small interface, placed at a clean seam and testable through that interface. Optimize for a human reading the flow and finding where a behavior lives.

| Boundary | Standard |
|---|---|
| Module | Own one coherent responsibility and hide its implementation decisions. Split by responsibility, not line count; extracting helpers alone does not create a deep module. |
| Entry point | Translate transport input and output; delegate the use case to a Service. Keep the flow readable at one level of abstraction. |
| Service | Own business rules and orchestration. Depend on explicit capabilities, with persistence behind a Repository and third-party integrations behind provider interfaces. |
| Pattern | Use Provider–Adapter, Repository, Service and dependency injection where they give a boundary a clear owner. Choose the smallest useful shape; functions and plain objects can do the job. Each layer must hide complexity or a decision that can change. |

## Changing code

**Delete before you add.** In the code the task touches, remove the dead code, the unused paths and the redundant guards first, then build on what is left. The smaller base often makes the next design obvious. A deletion in the diff is not a destructive action; Vasu reviews it there.

```
Task: add a 4th payment adapter. Two of the three adapters have no caller.
  delete the 2 dead adapters -> 1 adapter is left -> design the 2nd beside it
```

**One decision, one place.** Make the smallest change that solves the problem, unless **Build the requirement in** applies. When a new value has to pass through several layers (types, schemas, pipelines), stop and look for a direct path: read the value where it is used, or keep the decision in one place and pass its result.

```
Task: hide prices for guest users.
  thread isGuest: route -> controller -> service -> view model -> template, each checks it   5 decisions
  decide once: PricingService returns no prices for a guest; the template renders what it gets   1 decision
```

**Build the requirement in.** When a new requirement would add a branch at many sites, design what you would build if it had been there from the start, and carry it through types, docs, examples and tests.

```
Requirement: each customer sees only their own data.
  bolted on: if (tenantId) in 30 queries
  built in:  the repository takes a tenant, and no query runs without one
```

**Move every caller in the change that replaces the API.** When a new internal API replaces an old one, list its callers, move them all, and delete the old API in the same change. An internal caller gets no compatibility layer.

**Short path, little state.** A new reader answers "where does X come from?" and "what can change X?" without opening a pass-through layer. Inline a layer that passes its arguments through unchanged or hides no decision that can change. Prefer a return value to a mutation, a local to a field, and a field to module state. A third-party provider boundary stays, even with one caller: it is a seam for replacement, not a layer for the reader.

```
Where does the discount come from?
  before: Controller -> DiscountService -> DiscountManager -> DiscountHelper.calc()   4 files, 3 pass-throughs
  after:  Controller -> PricingService.discount(order)                                1 hop, the rule is in the Service
```

When a rule in this section changed what you built, the done report carries one line per rule: `<bold name>: <what it changed>`. When none did, add no line.

## Comments

A concise line above a function, a class or an exported type says how it is used. Inside the body, the code speaks. Keep every comment true to the code you change.

| Keep | Cut |
|---|---|
| The doc line above a function, class, or exported type | Narration of the next statement |
| A constraint from outside our code: a vendor bug, a protocol quirk, a platform limit. Link the issue. | A banner or a section divider |
| A legal or license header | Commented-out code |
| A lint suppression whose rule is style-only | Change history: "was X, now Y", "updated to handle Z" |
| | A sermon defending a workaround |

A comment that explains our own code is a bug report against the code. Rename the symbol, extract the function, or add the type until the comment says nothing new. Then delete the comment.

`@ts-ignore`, `# type: ignore`, `eslint-disable`: read the rule first. If it catches real bugs, fix the code. If you cannot fix it, say so in your report, not in a comment.

## Slop

| Slop | Instead |
|---|---|
| `try`/`catch` around code with no known failure | Let it throw. Catch only the failure you can name. |
| A fallback that swallows the error and returns a default | Fail loud, where the caller sees it |
| A guard for a state that cannot happen | Trust the type |
| An interface, a factory, or a config object justified only by hypothetical reuse | Write the one thing |
| `processV2`, `enhanced_parse`, `SmartCache`, `parse_new` | Edit the original in place |
| A parameter or a flag nobody passes yet | Add it when the second caller arrives |
| A hand-rolled copy of something the repo or the stdlib has | Search first, then call it |
| `✅ Done!`, emoji log lines, progress banners | The value, or nothing |
| A new `SUMMARY.md` or `IMPLEMENTATION_NOTES.md` after a change | The commit message |

## Words

Every string you write is copy: comments, commit messages, log lines, error text, UI text. Keep text that helps its reader understand the behavior or make a decision. Remove narration of the agent's process. The `copy` skill owns the rest.

## Unslop the diff

Before you report done, read the diff against Changing code, Comments, Slop and Words. Remove what adds no information or behavior.

## Third-party providers

Every third-party service or tool integration gets a provider boundary, even with one implementation and one caller. This is an intentional seam for replacement, coexistence and testing.

| Concern | Standard |
|---|---|
| Contract | Define the capability in application terms. Keep vendor SDK types, payloads and credentials inside the adapter; expose application-owned inputs, results and errors. |
| Adapter | Own all vendor HTTP or SDK calls, authentication, serialization, response validation and transport failure handling. Feature code calls the provider interface. |
| Composition | Inject providers at the application boundary. Keep selection and configuration there, so replacing a provider leaves business logic intact and two configured providers can coexist without changing a global singleton. |
| Verification | Test behavior through module interfaces with injected fakes. Test each adapter's mapping separately. Check that adding a provider changes adapter and wiring code, rather than scattering vendor branches through the feature. |

## Facts

A fact about a library, a vendor, or an environment comes from its source at the version in use, never from memory.

```bash
d=$(mktemp -d) && git clone -q --depth 1 --branch <tag> <repo> "$d"   # read, then rm -rf "$d"
```

Read the lockfile for the version first. A single file: `gh api repos/<owner>/<repo>/contents/<path>?ref=<tag>`.

## Blast radius

- Production, live databases, and daily-driver build or preview channels are off limits until Vasu names them. When a task sits next to one, name what you are about to touch, then wait for the yes.
- A destructive action Vasu did not ask for waits for the same yes.
- A local database, a worktree, a temp dir: disposable. `docker compose down -v` and rebuild beats a hand-patched row. Do not ask.
- A spend is a trade-off Vasu prices. A model swap, a paid run, a bigger box: ask first.
