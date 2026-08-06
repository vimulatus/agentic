---
name: to-spec
description: Turn the current conversation into a spec and publish it to GitHub (or a local file) — no interview, just synthesis of what you've already discussed.
disable-model-invocation: true
---

This skill takes the current conversation context and codebase understanding and produces a spec (you may know this document as a PRD). Do NOT interview the user — just synthesize what you already know.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching.

2. Check whether this is really **one** spec. Same rule as seams: the ideal number of problems per spec is one. Write a single-sentence problem statement covering everything discussed - if it only holds together by joining unrelated concerns with "and", or it doesn't reduce to one actor and one goal, it's more than one problem.

Splitting is by problem, never by layer: each split-off spec must still cover the full vertical slice of its problem (every layer it touches - UI, API, schema, etc.), not a fragment like "the backend half" of one feature. If the conversation covers multiple distinct problems, split here - each gets its own pass through steps 3-4 below (they can share the exploration from step 1) and its own publish. Cross-reference sibling specs by name/link in each one's Further Notes.

3. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

Check with the user that these seams match their expectations.

4. Write the spec using the template below, then publish it. Prefer GitHub: if the repo has a GitHub remote and `gh` works, open an issue and apply the `ready-for-agent` label — no other triage. Otherwise fall back to a local Markdown file at `<project_root>/docs/specs/`.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
