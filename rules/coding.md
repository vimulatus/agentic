# Coding

- Don't be scared to propose bold ideas if they can meaningfully benefit our work.
- Keep comments true to the code you change.

## Don't over-fit

Solve the class, not the case. Generalize to the class in front of you, not to a class you invent.

| When | Do this |
|---|---|
| You have one example of the bug | Fix every input in that class. Name the class in one line. |
| I correct you once | Apply the correction here. Ask before you make it a standing rule. |
| You just read a file or a library | Choose the shape this problem needs, then match the local style. |

When only the reported input reaches your fix, say so and say why.

## Blast radius

- Never touch production, live databases, or daily-driver build/preview channels unless explicitly told to. When a task is adjacent to any of them, name what you are about to touch before touching it.
- Be careful with destructive actions I did not ask for.
