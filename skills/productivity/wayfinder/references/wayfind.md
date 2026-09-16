# L2 — wayfind

Take one slice to a spec and its tickets. The first slice in the map with no parent issue is the one.

## 1. Blindspot pass

Name what you do not know that you should know. Give each one its cheapest probe.

| Blindspot | Probe |
|---|---|
| What the repo already does here | grep the call sites |
| What the domain assumes and you do not | ask Vasu |
| What the external API actually returns | read its docs |
| Who else reads or writes this data | grep the consumers |
| How it fails in production | read the error paths |
| What was tried before | read the git history |
| What an earlier slice already settled | read the map's decisions |

Drop every blindspot this slice does not touch.

## 2. Research, in parallel

Send every blindspot that waits on no other answer to the `research` skill now. They read in the background while you grill.

## 3. Grill

Call the `grilling` skill on what the research and the map's decisions cannot answer. A question the map answers is settled.

Record reversible planning assumptions in the map as `assumed: <question> — <answer>`. Keep unanswered load-bearing decisions open, mark affected tickets blocked for execution, and continue independent planning. Decisions Vasu already settled need no further confirmation.

## 4. Design direction

The slice adds a screen, or reshapes one, and neither the map's decisions nor the project's `DESIGN.md` settles how it looks and moves: show Vasu before you file. Ten UI tickets built on ten private guesses cost a full redesign, and a ticket filed before the pick carries a guess in its body.

1. Build the prototype with `prototype`, on its UI branch: 3 to 5 variants of the screens this destination needs, not one route. Build it whether or not Vasu is around to look; he answers in his own time.
2. Put it in the round, with the variant you recommend. It is one more load-bearing question, and `grilling` owns the form.
3. Write it into the map before he answers: `open: design direction — <url>, recommended ?v=<n>`. The map issue keeps the URL; with no tracker, the chat does.
4. Hold the tickets that depend on the pick. File everything else in step 5.

When Vasu picks, replace the `open:` line with the decision, then file the held tickets under the slice's parent. Each names the prototype URL and the variant; the first one creates `DESIGN.md` from it, so later slices and `dev` inherit the direction instead of reinventing it. One prototype serves the whole map: a later slice reads the decision and `DESIGN.md`, and prototypes again only for a screen they do not cover.

## 5. Tickets

Read the research files first, so the tickets carry their findings. Then call `to-tickets`.

It files one parent issue and a sub-issue per ticket. The parent is the slice: make it a child of the map issue.

```
map #1
  |-- parent #12   slice 1
  |     |-- #13    ticket
  |     \-- #14    ticket
  \-- parent #20   slice 2
        \-- #21    ticket
```

`cut.md` already cut the slice. `to-tickets` cuts tickets inside it, one context window each. It does not cut the slice again.

A ticket in a later slice may depend on a ticket in an earlier one. Name that ticket in its body, so `dev` reads it landed.

## 6. Next slice

Write the decisions into the map. Add ` — #<parent>` to the slice's line. Then return to step 1 for the next slice with no parent issue.

When every slice has its parent, name the ticket to start, and list the `open:` decisions and the tickets each one holds.
