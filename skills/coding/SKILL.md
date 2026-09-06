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

## Third-party providers

Every third-party service or tool integration gets a provider boundary, even with one implementation and one caller. This is an intentional seam for replacement, coexistence and testing.

| Concern | Standard |
|---|---|
| Contract | Define the capability in application terms. Keep vendor SDK types, payloads and credentials inside the adapter; expose application-owned inputs, results and errors. |
| Adapter | Own all vendor HTTP or SDK calls, authentication, serialization, response validation and transport failure handling. Feature code calls the provider interface. |
| Composition | Inject providers at the application boundary. Keep selection and configuration there, so replacing a provider leaves business logic intact and two configured providers can coexist without changing a global singleton. |
| Verification | Test behavior through module interfaces with injected fakes. Test each adapter's mapping separately. Check that adding a provider changes adapter and wiring code, rather than scattering vendor branches through the feature. |

## Facts

A fact about a library, a vendor, or an environment comes from its source at the version in use, never from memory. Four sessions shipped a wrong API and a wrong price before this line.

```bash
d=$(mktemp -d) && git clone -q --depth 1 --branch <tag> <repo> "$d"   # read, then rm -rf "$d"
```

Read the lockfile for the version first. A single file: `gh api repos/<owner>/<repo>/contents/<path>?ref=<tag>`.

## Blast radius

- Production, live databases, and daily-driver build or preview channels are off limits until Vasu names them. When a task sits next to one, name what you are about to touch, then wait for the yes.
- A destructive action Vasu did not ask for waits for the same yes.
- A local database, a worktree, a temp dir: disposable. `docker compose down -v` and rebuild beats a hand-patched row. Do not ask.
- A spend is a trade-off Vasu prices. A model swap, a paid run, a bigger box: ask first.
