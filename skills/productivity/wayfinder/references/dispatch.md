# L3 — dispatch

Every slice has its tickets. Hand the map to the queue.

```
issue-queue --map <map#>
```

`issue-queue` runs the tickets in slice order, through `orchestrate` and `dev`, and babysits the PRs. That is the long run Vasu lets loose. It is not this skill's.

Hand off with the `open:` decisions still open, and name the tickets each one holds. The queue's watch picks them up when they are filed.

Before you hand off, the tickets that are not code:

| The ticket needs | Reach for |
|---|---|
| an external fact | `research`, in the background |
| Vasu's taste, or a domain rule | `grilling` |
| to be seen before it is decided | `prototype` |

Close such a ticket with its answer in a comment, and add the decision to the map. When a decision overturns a later slice's tickets, rewrite those tickets before the queue reaches them.
