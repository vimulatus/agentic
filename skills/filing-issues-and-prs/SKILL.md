---
name: filing-issues-and-prs
description: Write an issue or PR body a cold reader can act on — Currently / Expected / Proposed Solution, with a worked example instead of prose. Use when filing a bug report or feature request, opening a pull request or writing its description, or when another skill needs an issue or PR body.
---

# Filing Issues and PRs

Write for a **cold reader**: someone who joined last week, holds none of your context, and will skim. They read the first screen and decide whether to act.

## The three beats

Every body opens the same way, in this order, under these exact headings:

- **Currently** — what happens today.
- **Expected** — what should happen instead.
- **Proposed Solution** — the direction you'd take.

A reader who stops after these three still knows what is wrong and what to do about it. Everything below them is optional; put it there or cut it.

## Show the failure, don't narrate it

The **worked example** is the load-bearing part of *Currently*. Give the real input and the real wrong output, with the right output beside it. One example — the smallest one that fails.

Not this:

> The invoice total is computed incorrectly when multiple line items carry different tax rates, which appears to stem from rounding being applied at the wrong stage of the calculation pipeline.

This:

> ```
> POST /invoices  { items: [ { amount: 100, tax: 5 }, { amount: 100, tax: 12 } ] }
>
> actual:   total 217.01
> expected: total 217.00
> ```

Prose makes the reader rebuild the failure in their head. An example hands it to them.

## File the finding, not the investigation

The path you took, the files you ruled out, the two hypotheses you discarded — the reader doesn't need any of it and won't read it. Cut it. A detail that doesn't change what the reader does next isn't detail, it's noise.

*Currently* and *Expected* are a sentence or two each, plus the example. If *Proposed Solution* runs past a short paragraph and maybe a snippet, you're designing in the issue — give the direction and leave the design to whoever picks it up. "I'm not sure where the fix belongs" is a fine *Proposed Solution*; a speculative essay is not.

## Plain words

A new joinee should get through it without effort. Domain words stay exactly as they are — `dip chart`, `voucher`, `RLS`, `landed cost` are the shared language, not jargon to translate. Everything else is plain: "the total is wrong when an invoice has two tax rates", never "the aggregation exhibits inconsistent behaviour under heterogeneous rate conditions".

No hedging stacks ("it may possibly be the case that"), no throat-clearing ("This issue aims to describe…"). Start at *Currently*.

## Title

The title states the wrong behaviour, or the wanted behaviour — never the area it lives in.

- ✅ `Invoice total off by a paisa when line items have different tax rates`
- ❌ `Invoice tax rounding`

## Templates

Read the one you need and follow its skeleton:

- Bug report → [`templates/bug.md`](templates/bug.md)
- Feature request → [`templates/feature.md`](templates/feature.md)
- Pull request → [`templates/pr.md`](templates/pr.md)
