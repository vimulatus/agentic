---
name: coding
description: How Vasu wants code written. Use whenever you write or edit code, and before you touch production or a live database.
---

# Coding

- Propose the bold idea when it pays. Say what it buys.
- Keep comments true to the code you change.

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

**Delete before you add.** Remove the dead code, the unused paths and the redundant checks first, then build on what is left. The smaller base often makes the next design obvious. Design for the usage you can see, not for an edge case you imagine.

```
Task: add a 4th payment adapter. Two of the three adapters have no caller.
  delete the 2 dead adapters -> 1 adapter is left -> design the 2nd beside it
```

**One decision, one place.** Make the smallest change that solves the problem. When a new value has to pass through several layers (types, schemas, pipelines), stop and look for a direct path: read the value where it is used, or keep the decision in one place and pass its result.

```
Task: hide prices for guest users.
  thread isGuest: route -> controller -> service -> view model -> template    5 files
  ask once: the template reads session.isGuest                                1 file
```

**Build the requirement in.** A new requirement changes the design as if it had been there from the start. Ask: if we wrote this today, with the requirement, what would we build? Then carry the change through every reference: types, docs, examples, tests. Plan the whole redesign, then deliver it in steps.

```
Requirement: each customer sees only their own data.
  bolted on: if (tenantId) in 30 queries
  built in:  the repository takes a tenant, and no query runs without one
```

**Move every caller, then delete the old path.** When a new internal API replaces an old one, list the callers, move them all, and delete the old API in the same change. Do not keep a compatibility layer for an internal caller. In a planned migration, a step may break what the next step fixes. Say where, and run the full gate at the end.

**A reader finds the answer in 30 seconds.** Count two costs: the layers between a question and its answer, and the state a reader must hold in their head. A new reader must answer "where does X come from?" and "what can change X?" in 30 seconds. Inline a wrapper that has one caller and a layer that passes its arguments through unchanged. Prefer a return value to a mutation, a local to a field, and a field to module state. A third-party provider boundary stays, even with one caller: it is a seam for replacement, not a layer for the reader.

```
Where does the discount come from?
  before: Controller -> DiscountService -> DiscountManager -> DiscountHelper.calc()   4 files, 3 pass-throughs
  after:  Controller -> discount(order)                                               1 function
```

The final message has one line for each rule in this section that changed a decision: `<rule>: <what it changed>`, where `<rule>` is the bold name.

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
