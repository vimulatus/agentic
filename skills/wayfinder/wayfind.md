# L2 — wayfind

Take the current slice to a spec and its tickets. One slice, not the map.

## 1. Blindspot pass

Name what you do not know that you should know. Give each one its cheapest probe.

| Blindspot | Probe |
|---|---|
| What the repo already does here | grep the call sites |
| What the domain assumes and you do not | ask the user |
| What the external API actually returns | read its docs |
| Who else reads or writes this data | grep the consumers |
| How it fails in production | read the error paths |
| What was tried before | read the git history |

Drop every blindspot the current slice does not touch.

## 2. Research, in parallel

Send every blindspot that waits on no other answer to the `research` skill now. They read in the background while you grill.

## 3. Grill

Call the `grilling` skill on what the research cannot answer.

## 4. Spec

Call `to-spec`. Read the research files first, so the spec carries their findings.

Publish the spec as a child of the map issue. It is the slice. Apply no label.

## 5. Tickets

Call `to-tickets` on that spec. File its tickets as children of the spec issue, and apply no label. The child edge is the record; `to-tickets` offers a `ready-for-agent` label, and you have instructed otherwise.

`to-tickets` says "vertical slice". At this level that word means **ticket**: one context window, green on its own. The slice was already cut in `cut.md`. Do not cut it again.

## 6. Stop

Write the decisions into the map. Name the ticket to start. Leave the next slice at one line.
