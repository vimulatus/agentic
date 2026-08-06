# Pull request

Same three beats, with the last one in past tense — the solution is no longer proposed, it's here. A reviewer is a **cold reader** too: don't assume they read the issue.

## Skeleton

```markdown
Closes #123

## Currently

What was wrong or missing, in one or two sentences. Repeat it even though
the issue says it — the reviewer is reading the diff, not the tracker.

## Expected

What should happen instead. One sentence.

## What changed

The shape of the change, not a file-by-file list. Git already shows the
files. Call out anything that will surprise a reviewer: a migration, a
behaviour change outside the stated scope, a deliberate omission.

## How to verify

The command to run, or the steps to click through. If a test covers it,
name the test.
```

## Filled example

```markdown
Closes #412

## Currently

An invoice with two different tax rates totals a paisa high — each line item
is rounded before the sum, so the error compounds.

## Expected

The total is rounded once, after all line items are summed.

## What changed

`InvoiceService.total()` now sums unrounded line amounts and rounds at the
end. Line items keep their unrounded values in the DB, so nothing needs a
backfill. No API shape change.

## How to verify

`bun run test:unit --filter @erp/invoicing` — the new case is
`totals a multi-rate invoice without compounding rounding`.
```

Keep the checklist noise out. If the repo template has one, fill it; don't invent one.
