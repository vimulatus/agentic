---
name: wayfinder
description: Cut "build X" into releasable slices, then ticket every slice. Use when Vasu names work bigger than one ticket. Not for a bug or a chore, which dev takes.
---

# Wayfinder

You produce the tickets for the whole map. You never write the code.

## Entry

Can you write the whole thing as one bite-sized ticket right now, with no unknowns?

- **Yes** — file that ticket, hand it to `dev`, and stop. Bugs, dependency bumps and renames leave here.
- **No** — read the map.

## Read the map

The map is the one open issue labelled `map`. Its state names the level.

| The map | Level | Read |
|---|---|---|
| does not exist | L1 cut | `cut.md`, to name the destination and cut the slices |
| a slice has no parent issue | L2 wayfind | `wayfind.md`, to take that slice to its tickets |
| every slice has a parent issue | L3 dispatch | `dispatch.md`, to pick the approach for one ticket |

## Walk the map

Slices go to ticket depth one at a time, in map order. A slice's decisions land in the map before the next slice opens, so the next slice grills on them and not on guesses.

Done looks like: every slice in the map carries its parent issue number, and every parent has its tickets. Then name the ticket to start.
