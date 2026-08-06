# Surface: Glossary

The glossary is the codebase's **architecture and infrastructure vocabulary** — the terms the *system's design* invented (a Scope, a Fence, a Bundle), as opposed to the terms the *business* speaks. An agent reads it before working so mechanism names in code, docs, and review comments resolve to one meaning.

Boundary with the [domain surface](domain.md): business language lives there and is **referenced from here, never duplicated** — a pointer up top routes the reader. When one word exists in both layers (a lowercase `role` on a domain entity vs an authz **Role**), flag the collision on both sides.

## Layout

- One flat file, `docs/glossary.md`, with a one-line charter up top: canonical terms, one name per concept, aliases are the words to avoid.
- Terms grouped under **subsystem** subheadings (Execution & context, Concurrency & transport, Authorization, Observability, …). If the file ever outgrows a cheap read, subsystem is the split axis.
- **No depth tier of its own.** The *why* behind these terms lives in the ADR log; an entry states what the term is and how it behaves, and does not restate the decision that produced it.

## Entry format

> **Fingerprint** — the hash of a request (method + path + body + `If-Match`) stored alongside the key as the *reuse guard*: same key + same fingerprint ⇒ replay; same key + different fingerprint ⇒ `422`. The key is what the client controls; the fingerprint is what catches accidental reuse.

- Bold term, then what it IS; give the shape inline when it's compact (`{ actor, tenantId, tx }`) and it sharpens the definition — an illustration, not a contract (code wins on shape).
- Denser than a domain bullet — a few sentences is fine, since there's no depth doc to push into — but every sentence must carry a rule or a distinction, not narration.
- **Name the seam.** When two mechanisms are adjacent enough to confuse, the distinction is part of the entry: "idempotency answers *did this exact request already happen?*; `If-Match` answers *has this resource moved under me?*"
- **Litmus tests and review flags.** When a term guards an escape hatch, the entry gives the test that licenses its use ("use only when there is *no request context to inherit*") and names the usage that's a review flag.
- ***Avoid:*** the aliases, so the canonical name is enforceable.

## Grilling

The [domain surface's grilling rules](domain.md#rules-while-grilling-the-domain) apply unchanged — challenge new terms against the existing language, sharpen near-synonyms into one canonical name, cross-reference claims against the code. The commonest failure here is a second name for an existing mechanism drifting in ("dedup key" beside **Idempotency key**); kill it at capture time by adding it to *Avoid*.
