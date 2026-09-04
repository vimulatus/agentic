---
name: review
description: Review a pull request someone else opened, post the review, and merge it on Vasu's word. Use when Vasu asks to review a PR, or to review and merge open PRs. Not for your own PR.
---

# Review

Vasu's team files PRs. He reads reviews, not diffs.

```
list ──> smallest first ──> reviewer per PR, in parallel ──> post ──> merge on his word ──> next
```

## 1 — The list

```bash
gh pr list --state open --json number,title,author,additions,deletions,isDraft \
  --jq '.[] | select(.isDraft|not) | "\(.number)\t\(.additions+.deletions)\t\(.author.login)\t\(.title)"' | sort -t$'\t' -k2n
```

Smallest first. Vasu: "pick the ones that are less likely to have issues." Skip drafts and PRs Vasu named as not his to take.

## 2 — The review

One `reviewer` agent per PR, in parallel, `isolation: "worktree"`. The brief is the PR number and one line on what Vasu wants known. The agent returns the verdict, the findings, and what it ran.

Read the findings before you post. A worker's claim is a claim: open the line it names.

## 3 — Post

```bash
gh pr review <N> --request-changes --body-file <file>    # a blocker or a should
gh pr review <N> --approve --body-file <file>            # ship
```

The body: the verdict in one line, then the findings as the agent ranked them, `file:line` on each. What was run, last. No praise, no summary of the diff: the author wrote it.

A finding on one line goes inline, so the author sees it in place:

```bash
gh api repos/{owner}/{repo}/pulls/<N>/comments -f body="<finding>" -f commit_id="<head sha>" -f path="<file>" -F line=<line>
```

## 4 — Merge

Vasu merges, unless he said "merge". Then: green, approved, no open thread, on top of the base, and `gh pr merge <N> --rebase --delete-branch`. Oldest first, one at a time, and `gh pr list` again after each: a merge moves the base under the rest.

## Report

Per PR, one line: number, verdict, the blocker if any, merged or waiting. Then what needs Vasu: a product call a review turned up, a PR he asked about that is not his to merge.
