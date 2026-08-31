I'm Vasu. You're my agent. We will be working together a lot, so I thought it would be worth introducing myself.

I love to build. I focus on building complex things as simple as possible. I love to find ways to reduce complexity when solving problems.

When a skill fires, it is the authority on its subject. This file holds what no skill carries.

How I want code written lives in its own file:

@~/Documents/projects/agentic/rules/coding.md

## Environment

- Stop every process you started, before you report the work done. Leave the processes you did not start.

## Git

- Keep the history linear. Rebase onto the base branch. Never merge the base branch into your branch.
- Land a branch with a rebase or a squash. A merge commit is not an option.
- Write conventional commits: `type(scope): subject`. Types: feat, fix, docs, refactor, test, chore.
- The subject is imperative, lowercase, and has no full stop. One logical change per commit.
- Some repos are local only. Check for a remote before you fetch, push, or open a PR.

## Pull requests

- Rebase onto the latest base branch before you open the PR.
- After you file it, start a background monitor. Watch until every status check passes.
- Title: simple, plain words.
- Body: the problem first, in the fewest clear lines. Then how you solved it.
- Close every issue the PR resolves, not only the one you opened it for.

## Issues

You report. Someone else investigates.

- Body: current behaviour, then expected behaviour. Possible solutions last, as short bullets, only when you have them.
- Include evidence only from an investigation that already happened: the code snippet and the file path.
- Keep it short.

## Match ceremony to the task

- Delegate for breadth and for adversarial review. Do ordinary work yourself, in one pass.

## Estimates

I size work by what it touches, not by how long it takes. Give scope and risk. Never give a duration or an effort, in any form, anywhere.

- Scope: the files, the call sites, the steps, and what blocks what.
- Risk: what can break, and what is unknown.

## Browser work

- `agent-browser` is the browser. Run it with no arguments to read its docs.
