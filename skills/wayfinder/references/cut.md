# L1 — cut

Turn "build X" into an ordered list of slices, then write the map.

## 1. Name the destination

One sentence, with no "and". If it needs an "and", it holds more than one destination. Ask which one.

## 2. Cut into slices

A slice is:

1. something a person, a dev, or a program can interact with
2. that gives someone named a value
3. that stands alone — nothing else has to land for it to be worth having
4. that does not split into two things which also pass 1-3

Apply rule 4 until it stops splitting. The smallest thing that still passes is the slice.

Infrastructure has no slice of its own. It rides along inside the first slice that needs it.

| Candidate | Verdict |
|---|---|
| Auth | splits — not a slice |
| Add email and password login | slice |
| Add passkey login | slice |
| Add the user schema | fails 2 — it rides inside email and password login |
| Allow the user to send feedback | slice |
| Email that feedback to me | a second slice |
| `POST /feedback`, with no UI | slice — a program interacts with it |
| A feedback form that logs to the console | fails 2 — a fragment of a slice |
| Move the database from Postgres to SQLite | slice — you and ops get the value |
| Set up CI | slice — the devs get the value |
| Dark mode, where no theme system exists | one slice; the theme system rides along |

## 3. Order them

The first slice is the thinnest one Vasu would actually run. Each slice after it builds on what has landed.

## 4. Write the map

One issue, labelled `map`. Every ticket is a child of it.

<map-template>

## Destination

One sentence.

## Slices

1. <title>
2. <title>
3. <title>

A slice gains ` — #<parent>` when its tickets are filed.

## Ideas

Everything Vasu said he might build. Unordered, one line each. An idea becomes a slice only when Vasu promotes it.

## Decisions

One line per answered question, with its answer.

## Out of scope

What the destination excludes.

</map-template>

Then read `wayfind.md` and walk the slices in order.
