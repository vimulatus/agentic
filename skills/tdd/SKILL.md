---
name: tdd
description: Test-driven development — the red→green loop. Use before implementing new logic, fixing a bug, or modifying existing behavior; when the user mentions red-green-refactor or test-first; or before any change that could break existing behavior.
---

# Test-Driven Development

The loop is **red → green**. Write the test first, watch it fail, then write only enough code to pass it.

A test that passes on its first run proves nothing — it must go **red** first, for the reason you expect. If it's green before you've written the code, it isn't testing what you think.

## The loop

- **Red before green.** One failing test, confirmed red, before any implementation.
- **Minimal green.** Only enough code to pass the current test. No speculative features, no anticipating the next test.
- **Vertical slices, not horizontal.** One test → one implementation → repeat, each slice a tracer bullet that responds to what the last taught you. Never write all the tests first and then all the code — bulk tests verify *imagined* behavior and go insensitive to real changes.

Simplification and refactoring are **not** part of this loop — they come after, at the review/simplify stage.

## Bugs: prove it first

When a bug is reported, do **not** start with the fix. Write a test that reproduces the bug and watch it fail — **red confirms the bug exists**. Then fix it — **green confirms the fix**, and the test guards the regression forever.

## What makes a test worth keeping

- **Test behavior at seams, not internals.** Assert at the public boundary. A good test reads like a specification ("rejects tasks with empty titles") and survives refactors because it doesn't care about internal structure.
- **State, not interactions.** Assert on the outcome, not on which internal methods were called — interaction tests break on refactor even when behavior is unchanged.
- **No tautologies.** The expected value must come from an independent source of truth — a known-good literal, a worked example, the spec — never recomputed the way the code computes it (`expect(add(a,b)).toBe(a+b)` passes by construction and can never disagree with the code).
- **Real over mocks.** Prefer real > fake > stub > mock. Mock only slow or non-deterministic boundaries (external APIs, email). Over-mocking makes tests pass while production breaks.
- **DAMP over DRY.** Each test self-contained and readable as its own spec; duplication is fine when it makes a test understandable on its own.

## Done when

Each cycle ends with the new test green **and the whole suite green**. Every new behavior has a test; every bug fix has a reproduction test that was red before the fix.
