---
name: benchmark
description: Vet a measured number before you report it or act on it - a speedup, a regression, a latency, a throughput, an eval score. Use when you run a benchmark, compare options on speed, or claim that something got faster or slower. Not for a correctness bug, which red-green owns.
---

# Benchmark

A run that went wrong still prints a plausible number. Failed requests, a cache that skipped the work, code that never ran, an untuned side and noise all look fine in the output. Before you trust, report or act on a number, name what limits it and rule out that it measured something else.

Answer each question with evidence from a run, not from a reading of the code.

## Before the first run

- Write the claim you expect to make, in the words you would report: "export is 30% faster at p50 on the 60k-row dataset". The questions test that sentence.
- Read the measurement script. Note what it times, what it counts and what it ignores.
- Check the machine: `uptime` for load, `sysctl -n hw.ncpu` or `nproc` for cores. If you cannot quiet a busy machine, alternate the sides so both see the same noise, and say so in the report.

## The questions

1. **Why not double?** Name the resource or code path that bounds the result: a core, a lock, the disk, the network, or the load generator itself. Get it from a profile or system counters, in a run you do not report, because profilers slow the work. Map the hot spot to source. If the load generator saturates first, you measured the load generator. If a change did not move the number, the limiter says why.
2. **Was each side tuned?** Run every side the way production runs it: release builds, production flags and env, pools, batching, caches as warm or cold as production sees them, the same versions and data. One side on defaults compares configurations, not implementations. A limiter that is a setting (a commit per row, a debug build, a missing index) means that side is untuned: tune it and measure again before you pick a winner.
3. **Did it break a limit?** Do the arithmetic against the hardware and against the share of the work. Removing a piece that takes 10% of the run makes the run at most about 11% faster. A result past a limit measured a cache, a no-op or a bug.
4. **Did it error?** Count failures and non-success responses, and check that outputs are correct, not only present. Rejections are often fast; timeouts and retries are slow. If the script does not count errors, add the count.
5. **Does it reproduce?** Run each side at least 5 times, alternating A, B, A, B, so warmup, lazy initialization and drift do not favor one side. Report the median and the range. A gap smaller than the run-to-run spread is no measurable difference.
6. **Does it matter?** Next to a micro result, measure the end-to-end path a user waits on, with realistic data and concurrency. Report the micro result as a share of the whole: a helper that takes 1% of a request makes the request at most 1% faster.
7. **Did the work happen?** Confirm the work ran inside the timed region: the request reached the server, the rows were written, the result was used. A generator nobody iterates, a promise nobody awaits, a result the JIT discards and a timeout all produce numbers for work that never happened.

A quick ballpark that Vasu asked for needs one run. Still answer 4 and 7, and say it is one run. A choice between options is never a ballpark.

An eval score (a prompt, a model, an agent) answers 4, 5 and 7: every trial did the task, the gap holds across trials, and the scenario ran.

## Report

Lead with the verdict: faster, slower, no measurable difference, or inconclusive.

Give the number with its unit, the run count, the range and the limiter:

```
p50 41 ms -> 33 ms, median of 7 runs per side, range 32-35 ms after,
bound by JSON parsing on one core.
```

The verdict is inconclusive when you cannot name the limiter, a side ran untuned, or you could not answer 4 and 7. Name the gap.

Runs across time or across many trials go on a chart, on one `handout` page, with every run plotted. A PR body carries one primary number and links the page with the runs, the range and the limiter evidence.
