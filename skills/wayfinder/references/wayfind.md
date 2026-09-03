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

When Vasu is not there to answer, pick the answer you would defend and write it into the map's decisions as `assumed: <question> — <answer>`. Carry on. He overturns it when he reads the map.

## 4. Tickets

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

## 5. Next slice

Write the decisions into the map. Add ` — #<parent>` to the slice's line. Then return to step 1 for the next slice with no parent issue.

When every slice has its parent, name the ticket to start.
