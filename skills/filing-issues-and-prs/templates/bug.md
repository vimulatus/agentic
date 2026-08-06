# Bug report

## Skeleton

```markdown
## Currently

One or two sentences: what happens. Then the smallest failing example —
input, actual output, expected output — in a code block.

## Expected

What should happen instead. Usually one sentence.

## Proposed Solution

Where the fix goes and roughly what shape it takes. One paragraph.
"Not sure yet" is a valid answer — say that rather than guess at length.

## Notes (optional)

Environment, a related issue, a log line. Only what changes the reader's
next move.
```

## Filled example

````markdown
## Currently

An invoice with two different tax rates totals a paisa high. Rounding is
applied per line item and then summed, so the error compounds.

```
POST /invoices  { items: [ { amount: 100, tax: 5 }, { amount: 100, tax: 12 } ] }

actual:   total 217.01
expected: total 217.00
```

## Expected

The total is rounded once, after all line items are summed. Two items at
5% and 12% on ₹100 each total ₹217.00.

## Proposed Solution

Sum the untouched line amounts first, round the total at the end. The
rounding call in `InvoiceService.total()` is the only site that changes;
line items keep their unrounded values in the DB.
````

Note what the example does *not* contain: how the bug was found, which files were read, what else was suspected. The reader gets the failure, the target, and where to start.
