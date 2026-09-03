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

- Every project CLAUDE.md carries a `## Product` section: what it is, who uses it, its stage. Read it before you plan.
- Never write or edit that section by hand. Load the `product-context` skill and let it write.
- Missing, or wrong about what you just learned? Same skill, same rule.

## Environment

- Stop every process you started, before you report the work done. Leave the processes you did not start.

## Git

- Keep the history linear. Rebase onto the base branch. Never merge the base branch into your branch.
- Land a branch with a rebase or a squash. A merge commit is not an option.
- Write conventional commits: `type(scope): subject`. Types: feat, fix, docs, refactor, test, chore.
- The subject is imperative, lowercase, and has no full stop. One logical change per commit.
- Some repos are local only. Check for a remote before you fetch, push, or open a PR.

## Pull requests

How I want a PR opened, and how it gets to ready, lives in the `pr` skill. Load it before you open one.

## Issues

You report. Someone else investigates.

- Body: current behaviour, then expected behaviour. Possible solutions last, as short bullets, only when you have them.
- Include evidence only from an investigation that already happened: the code snippet and the file path.
- Keep it short.

## Match ceremony to the task

- More than one independent task in a run? Load the `orchestrate` skill. It owns the workers.
- Do ordinary work yourself, in one pass.

## Estimates

I size work by what it touches, not by how long it takes. Give scope and risk. Never give a duration or an effort, in any form, anywhere.

- Scope: the files, the call sites, the steps, and what blocks what.
- Risk: what can break, and what is unknown.

## Browser work

- `agent-browser` is the browser. Run it with no arguments to read its docs.
