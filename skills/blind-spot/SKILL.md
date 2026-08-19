---
name: blind-spot
description: Map what he does not know he does not know about an unfamiliar field, then turn that map into his next prompt. Use only when he types /blind-spot. Not for a field he already works in, and not for reviewing code he wrote.
---

# Blind spot

He knows nothing about this field. Give him what he would not have thought to ask.

## Scope first

One field name covers several machines. Each machine needs a different map.

1. Read the repo. It may already decide the machine.
2. When it does not, table the readings - the kind, one example, the hard part - and ask which one. One line.
3. Write the map after he picks.

## What lands in the map

| Keep | Drop |
|---|---|
| A thing he assumes, that is false | A thing he has not read yet |
| A decision he will make by accident | A definition he can look up |
| A cost that arrives after the build | A tour of the field |

Rank the rows by what the mistake costs him. The most expensive row goes first.

## Close with his prompt

End with the questions whose answers turn his next prompt into a spec. Ask only the ones that change the build. Give your recommended answer under each one, so he can answer by agreeing.

Facts are your job. Look up anything the repo, the docs, or a tool can answer. Put only the decisions to him.

Done when he can answer every question without reading anything else.
