# Surface: Domain

The domain surface is the project's **ubiquitous language** — the business vocabulary that domain code, UI copy, and docs must all speak — plus a model of each concept behind the words. An agent reads it before working so it can converse in the project's terms without asking or, worse, assuming.

**It is never the source of truth for shape.** Once code exists, the code is. The surface holds the semantic layer — definitions, roles, invariants, rationale, rejected alternatives — and any type sketch in it is an *illustration* that gets a point across, not a contract. When doc and code disagree, the code wins on shape; surface the drift.

## Layout and split axis

- **Breadth** — `docs/domain.md`: the glossary. One bullet per term.
- **Depth** — `docs/domain/<concept>.md`: one doc per **concept** that has outgrown its bullet.
- **Pending** — `docs/domain/pending.md`: the ledger of concepts identified but not yet designed.

The split axis is the **concept** — never the module or package. Concepts are the stable thing; module boundaries are soft, and a concept used by several modules (a Party shared by CRM, Payroll, Sales) can't belong to any one module's doc.

Business language only. Architecture and infrastructure terms are a different vocabulary — they belong to the [glossary surface](glossary.md), which cross-references this one, never duplicates it. When one word exists in both layers (a lowercase `role` on a domain entity vs an authz **Role**), flag the collision on both sides.

## Breadth: the glossary (`docs/domain.md`)

One bullet per term:

> **Party** — a single identity posted against as a subledger; customer/vendor are *roles*, not separate entities. [`party.md`](./domain/party.md). *Avoid: separate Customer/Vendor entities.*

- Bold term, then a tight definition: what it IS, one sentence, plus at most one load-bearing qualifier.
- ***Avoid:*** the aliases *and the tempting wrong models*, so the canonical choice is enforceable, not just stated.
- Pointer to the concept's depth doc, where one exists.
- Group under subheadings when natural clusters emerge; a flat list is fine until then.

## Depth: one doc per concept (`docs/domain/<concept>.md`)

Created when a concept outgrows its bullet — when it accumulates invariants, rejected alternatives, or relationships the glossary line can't carry. Anatomy, in roughly this order (skip what a concept doesn't have):

- **Status blockquote** first — design maturity (`SETTLED`, `DESIGNED, not built`, or per-part: "line-level SETTLED; full model LARGELY RESOLVED") plus links to the sibling concepts it references. Status says how much weight the design can bear — it does not confer authority over the code.
- **What it is** — the definition expanded, with a type sketch when it carries the argument (a `// NOTE: no currency field` comment can *be* the point).
- **Load-bearing decisions** — one section per decision that shapes the concept, with alternatives inline as `> *Considered and rejected:* …` blockquotes and *why*. Domain decisions live here, in the concept doc; the ADR log is for architecture.
- **Invariants** — the fail-closed rules as checkable predicates (`leaf ⟺ postable ∧ childless`), each with its enforcement point named ("enforced at `post`").
- **Boundaries & references** — what this concept references, what uses it, which modules touch it.
- **Open threads** — sub-decisions parked, each named. Mirror them in the pending ledger's open-threads list; strike when resolved.

## Pending: the ledger of the undesigned (`docs/domain/pending.md`)

One file tracking every concept identified but not yet designed:

- Ordered by scope priority (current version first), dependencies noted (`✓` = already captured).
- A concept **graduates**: once designed it gets its own depth doc and is struck from the list.
- **Cut** concepts keep their reasoning and an explicit **earning trigger** — the observable event that reopens them ("a real user transacts in a foreign currency") — so a cut is a decision, not amnesia.
- An **open threads** roll-up of the sub-decisions parked inside captured docs.
- An explicit **not-in-scope** fence naming what's beyond the current effort, so absence isn't mistaken for fog.

## Rules while grilling the domain

- **Challenge against the glossary.** When a term conflicts with the existing language, call it out immediately: "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"
- **Sharpen fuzzy language.** When a term is vague or overloaded, propose a precise canonical term: "You're saying 'account' — do you mean the Customer or the User? Those are different things."
- **Discuss concrete scenarios.** Stress-test relationships with specific, edge-probing scenarios that force precision about the boundaries between concepts.
- **Cross-reference with code.** When the user states how something works, check whether the code agrees; surface any contradiction.
- **Demand the earning trigger.** When scope is cut or deferred, don't record the cut without the observable event that would earn it back.
