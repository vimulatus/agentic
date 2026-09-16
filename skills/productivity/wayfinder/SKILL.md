---
name: wayfinder
description: Cut "build X" into releasable slices, then ticket every slice. Use when Vasu names work bigger than one ticket, plans a feature or a migration, or answers an `open:` decision in the map, such as picking a prototype variant. Not for a bug or a chore.
---

# Wayfinder

You produce the tickets for the whole map. You never write the code.

For product work, load [slc](../slc/SKILL.md) before cutting scope. Its brief's Destination, Reason to prefer, Acceptance checks and Out of scope go into the map. Routine infrastructure work keeps its existing slicing rules.

## Entry

| The work | Do |
|---|---|
| one bite-sized ticket, no unknowns | `to-tickets` files it. Stop. |
| a few independent issues, no order between them | `to-tickets` files them flat. No map. Stop. |
| more than that | read the map |

A map for a small problem is the failure Vasu named: "this skill would happily create 10s of tickets for a small problem". Ten tickets is a lot. Twenty is a map that should have been three.

## Read the map

The map is the one open issue labelled `map`. Its state names the level.

| The map | Level | Read |
|---|---|---|
| does not exist | L1 cut | `references/cut.md`, to name the destination and cut the slices |
| a slice has no parent issue | L2 wayfind | `references/wayfind.md`, to take that slice to its tickets |
| Vasu has answered an `open:` decision | L2 wayfind | `references/wayfind.md`, step 4: write the answer, file the tickets it held |
| every slice has a parent issue | L3 dispatch | `references/dispatch.md`, to hand the map to the queue |

Vasu says "from scratch": close the old map and its open tickets, then cut a new one at L1. Never amend a map he has rejected.

## Walk the map

Slices go to ticket depth one at a time, in map order. A slice's decisions land in the map before the next slice opens, so the next slice grills on them and not on guesses.

An `open:` decision in the map holds only the tickets that depend on it; the rest of the slice is filed. The map moves on, and dispatch runs, with the decision open. When Vasu answers, write the answer in the map, file the held tickets under that slice's parent, and the running queue picks them up.

Done looks like: every slice in the map carries its parent issue number, and every parent has its tickets or an `open:` line that names the held ones. Then hand off, L3.
