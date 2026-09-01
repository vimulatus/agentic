---
name: wayfinder
description: Cut "build X" into releasable slices, then spec one. Use when the user names work bigger than one ticket. Not for a bug fix or a chore, which go straight to `dev`.
---

# Wayfinder

You produce a spec. You never write the code.

## Entry

Can you write the whole thing as one bite-sized ticket right now, with no unknowns?

- **Yes** — file that ticket, hand it to `dev`, and stop. Bugs, dependency bumps and renames leave here.
- **No** — read the map.

## Read the map

The map is the one open issue labelled `map`. Its state names the level.

| The map | Level | Read |
|---|---|---|
| does not exist | L1 cut | `cut.md`, to name the destination and cut the slices |
| the current slice has no spec issue | L2 wayfind | `wayfind.md`, to take one slice to a spec |
| the current slice has open tickets | L3 dispatch | `dispatch.md`, to pick the approach for one ticket |

## The stop rule

Only one slice is ever at ticket depth. Every other slice stays one line.

Fog is not a problem to clear. Fog is the slices you have not earned yet.

When the current slice has its tickets, stop. Name the ticket to start. Do not open the next slice.
