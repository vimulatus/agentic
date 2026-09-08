---
name: architecture
description: Find architectural friction worth fixing. Use when Vasu asks to improve codebase architecture or find refactoring opportunities. Not for implementing an already chosen refactor.
---

# Architecture

Find changes that make the next change easier. Deliver a recommendation Vasu can judge before designing the implementation.

## Find the cost

- Start with the area Vasu named. Otherwise, use recent commit history to locate recurring work; churn directs the search, not the verdict.
- Read the project's own domain terms and relevant recorded decisions wherever they live. Use those names in the findings.
- Trace a concrete behaviour through its callers, implementation and tests. Record where understanding or changing it requires knowledge scattered across files.
- Prefer a demonstrated maintenance cost over a hypothetical future need. If nothing warrants a refactor, say so.

## Judge the boundary

A deep module hides substantial complexity behind a small interface. Depth is about what callers must understand, not file size.

| Signal | Question that decides the recommendation |
|---|---|
| A wrapper exposes almost everything beneath it | Would removing it reduce what a caller must know? |
| One change repeatedly touches several modules | Which responsibility could own that change in one place? |
| Tests mock the internal call chain | Could the same behaviour be checked through a stable entry point? |
| Infrastructure details spread into domain logic | What would an adapter actually hide from its callers? |

Price the migration, compatibility and lost flexibility against the saved work. Preserve a useful boundary even when merging files would look simpler. Reopen a recorded decision only with evidence that its trade-off has changed.

## Show the choice

Load `handout` in Report mode. Lead with the best opportunity and why it earns the disruption. Include only candidates supported by the investigation.

Each candidate carries:

- The observed cost, with file and line evidence.
- A before/after picture showing which responsibilities move and what callers stop knowing.
- The expected testing benefit, migration cost and uncertainty.
- A recommendation: pursue, investigate further, or leave alone.

Keep proposed signatures for the selected candidate. Deliver the report and ask which opportunity Vasu wants to pursue, unless the request already chose it.

## Resolve the chosen change

Load `grilling` for the load-bearing decisions. Settle reversible implementation choices yourself. Compare competing designs when they expose a meaningful trade-off.

Finish with the responsibility being moved, the caller contract, the behaviour tests must preserve and the smallest useful migration. Match the next action to Vasu's request: `to-tickets` for filing, `wayfinder` for work spanning tickets, `coding` for implementation. A review request ends with the recommendation.
