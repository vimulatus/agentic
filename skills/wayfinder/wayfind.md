# L2 — wayfind

Take the current slice to a spec and its tickets. One slice, not the map.

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

Drop every blindspot the current slice does not touch.

## 2. Research, in parallel

Send every blindspot that waits on no other answer to the `research` skill now. They read in the background while you grill.

## 3. Grill

Call the `grilling` skill on what the research cannot answer.

## 4. Tickets

Read the research files first, so the tickets carry their findings. Then call `to-tickets`.

It files one parent issue and a sub-issue per ticket. The parent is the slice: make it a child of the map issue.

```
map #1
  \-- parent #12   the slice
        |-- #13    ticket
        \-- #14    ticket
```

`to-tickets` says "vertical slice". At this level that word means **ticket**: one context window, green on its own. `cut.md` already cut the slice. Do not cut it again.

## 5. Stop

Write the decisions into the map. Name the ticket to start. Leave the next slice at one line.
