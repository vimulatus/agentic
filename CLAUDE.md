I'm Vasu. You're my agent. We will be working together a lot, so I thought it would be worth introducing myself.

I love to build. I focus on building complex things as simple as possible. I love to find ways to reduce complexity when solving problems.

## Environment

- A VPS. I have no browser on this box. `open <file>.html` reaches nobody. Serve the file over HTTPS and give me the URL.
- I connect over the tailnet, and the tailnet is up. Serve on the tailnet address, not `localhost`.
- Stop every process you started, before you report the work done. Leave the processes you did not start.

## Coding Preferences

- Keep things simple.
- Don't be scared to propose bold ideas if they can meaningfully benefit our work.
- Be careful with destructive actions that are not explicitly requested by the user.
- Don't write endless smoke tests, "regression tests" for feature deletions, etc. Tests should be focused, not slop.
- Comments should be used to clarify functionality and how code is used. Don't comment every line, but describe, concisely, how functions are used above function definitions, classes, etc.
- Keep comments up to date when making changes.

## Pull requests

- Rebase onto latest `origin/main` before you open the PR.
- After you file it, start a background monitor. Watch until every status check passes.
- Title: simple, plain words.
- Body: the problem first, in the fewest clear lines. Then how you solved it.
- Close every issue the PR resolves, not only the one you opened it for.

## Issues

You report. Someone else investigates.

- Body: current behaviour, then expected behaviour. Possible solutions last, as short bullets, only when you have them.
- Include evidence only from an investigation that already happened: the code snippet and the file path.
- Keep it short.

## Don't over-fit

Solve the class, not the case. Generalize to the class in front of you, not to a class you invent.

| When | Do this |
|---|---|
| You have one example of the bug | Fix every input in that class. Name the class in one line. |
| I correct you once | Apply the correction here. Ask before you make it a standing rule. |
| You just read a file or a library | Choose the shape this problem needs, then match the local style. |
| You test code that already exists | Derive the test from the requirement, then check the code against it. |

When only the reported input reaches your fix, say so and say why.

## Match ceremony to the task

- Do not spawn subagents or a multi-agent panel for work a single agent finishes in one pass. Delegation is for breadth and adversarial review, not for ordinary tasks.

## Estimates

I size work by what it touches, not by how long it takes. Give scope and risk. Never give a duration or an effort, in any form, anywhere.

- Scope: the files, the call sites, the steps, and what blocks what.
- Risk: what can break, and what is unknown.

## Verify a UI change

- Drive the `agent-browser` CLI tool, not Playwright. Run `agent-browser` with no arguments to read its docs.

## UI copy

- Write interface text for the person using the screen, not the person who built it. The README's voice is wrong in a button.

## Blast radius

- Never touch production, live databases, or daily-driver build/preview channels unless explicitly told to. When a task is adjacent to any of them, name what you are about to touch before touching it.
