---
name: blacksmith
description: Move GitHub Actions CI onto Blacksmith runners and sticky-disk caching. Use when CI is slow, or when the user names Blacksmith. Not for tuning the suites themselves.
---

# Blacksmith

```
  gate ──> swap the runners ──> cache what repeats ──> PR ──> the run leaves `queued`
   │                                                              │
   │                                                              └── it does not:
   └── owner is a User: stop. Blacksmith is org-only.                  the app is not installed
```

Change one thing. The runner swap is a no-op for behaviour, so it lands alone and proves itself before any cache does.

## 1 — The gate

```sh
gh api users/$(gh repo view --json owner --jq .owner.login) --jq .type   # Organization
```

`User` means stop. Blacksmith runs on GitHub organizations only, and a personal repo's jobs sit in `queued` forever with no error. Report the gate; do not write the diff.

## 2 — Swap the runners

`blacksmith-<N>vcpu-ubuntu-{2204,2404}[-arm]`, N in 2 4 8 16 32. Also `-windows-2025`, and `blacksmith-{6,12}vcpu-macos-{latest,15,26}`.

**Match the core count.** `ubuntu-latest` is 2 cores, so it becomes `blacksmith-2vcpu-ubuntu-2404`. Scaling up is a second change, made after the first is green — otherwise a suite that breaks under more parallelism looks like Blacksmith breaking.

Every `runs-on` in every workflow file, including the deploy ones a branch never exercises.

## 3 — Cache what repeats

Three tiers. Read them in order and stop at the one that pays.

**Free, no diff.** Blacksmith redirects `actions/cache`, `actions/setup-{go,node,python,java}` and `ruby/setup-ruby` to a colocated store, and keeps `docker pull` images on a shared disk. Say "nothing to do" and move on. Adding an action here is work that buys nothing.

**Sticky disk.** A persistent ext4 volume. A job hydrates a clone of the last snapshot in seconds, writes to it, and commits it back at the end.

```yaml
- uses: useblacksmith/stickydisk@v1
  with:
    key: ${{ github.repository }}-bun-cache
    path: ~/.bun/install/cache
```

Reach for it when the same bytes cross the network on every run: a package cache a wide matrix re-downloads, a browser binary, a build cache no setup action covers.

**Cache the package manager's global cache, not the dependency tree.** `node_modules` on a disk is faster still, but it keys on the lockfile hash and puts a stale-tree failure class into CI. The global cache keeps `install --frozen-lockfile` the authority on what lands on disk.

| Toolchain | path |
|---|---|
| bun | `~/.bun/install/cache` |
| pnpm | `~/.pnpm-store` |
| npm, yarn | `~/.npm`, `~/.cache/yarn` |
| playwright | `~/.cache/ms-playwright` |
| go | `~/.cache/go-build`, `~/go/pkg/mod` |
| cargo | `~/.cargo/registry`, `~/.cargo/git` |

Key on `${{ github.repository }}-<what>` and nothing else. A `github.ref` in the key gives every branch a cold disk on its first run, which is the cost you came to remove.

5 disks per job. Evicted after 7 days idle. $0.50/GB/mo.

**Neither.** Skip a candidate that does not repeat. Checkout caching (`useblacksmith/checkout@v1`) pays on a large `.git`; on a small one a shallow clone already costs seconds. Measure with `du -sh .git` before you add it.

## 4 — The settings the diff cannot carry

Say these out loud in the PR body. They live in the Blacksmith dashboard and a reviewer who does not set them gets a broken cache, not a red check.

- **The GitHub App**, on the org. Without it no runner answers the label.
- **Sticky-disk branch protection.** Off, any `pull_request` job commits its snapshot and a branch decides what `main` hydrates from. On, a branch reads and only a push to the default branch commits.

## 5 — Verify

Open the PR and watch the first run. The claim is not "the checks are green" — it is "a Blacksmith runner picked the job up".

| What you see | What it means |
|---|---|
| Jobs start inside a minute | The runners answer. Read the timings and compare. |
| Every job stuck in `queued`, none started | No runner answers the label. The app is not installed on the org. |
| A green check while the jobs sit queued | A GitHub App, not a runner. It proves nothing. |

The cache proves itself on the **second** run on the default branch, never the first: run one hydrates an empty disk and commits it.
