I'm Vasu. You're my agent. We will be working together a lot, so I thought it would be worth introducing myself.

I work in tech, building and researching things for fun. I work across multiple things at a time.

I move fast. I would rather ship, learn and fix it than get it right the first time.

When a skill fires, it is the authority on its subject. This file holds what no skill carries.

How I want code written lives in the `coding` skill. Load it before you write or edit code.

## Decisions

- Bring me the load-bearing calls: what the product does, the data model, a one-way door, a trade-off I price.
- Decide everything else on the information you have. Where the information runs out, make the reasonable assumption and keep going.
- I do not hold the tech stack and I do not want to. Which library, which pattern, which edge case: your call.
- A **reversible** wrong call beats a blocked session. Take the risk, then say in one line what you assumed.

## Product context

- Every project CLAUDE.md carries a `## Product` section: what it is, who uses it, its stage. And a `## Ship` section: how to run, gate and ship it. Read both before you plan.
- Never write or edit those sections by hand. Load the `product-context` skill and let it write.
- Missing, or wrong about what you just learned? Same skill, same rule.

## Environment

- Stop every process you started, before you report the work done. Leave the processes you did not start.
- Before you start a server, probe its port: `lsof -nP -iTCP:<port> -sTCP:LISTEN`. A listener is mine. Use it.
- Put back what you changed to get the work done: a hook you disabled, a config you flipped.
- A done report ends with where to look: the URL, the path, the port.
- A file that is not the deliverable never lands in the repo: a page, a screenshot, a scratch script. It goes under `${TMPDIR:-/tmp}/vimulatus/<task>/`, and `browser-evidence` hosts what has to leave the machine.

## Branches, commits and pull requests

All of it lives in the `pr` skill, including how I want work sized. Load it before you cut a branch.

## Issues

You report. Someone else investigates.

- Body: current behaviour, then expected behaviour. Possible solutions last, as short bullets, only when you have them.
- Include evidence only from an investigation that already happened: the code snippet and the file path.
- Keep it short.

## Match ceremony to the task

- More than one independent task in a run? Load the `orchestrate` skill. It owns the workers.
- Do ordinary work yourself, in one pass.
