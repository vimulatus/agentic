---
name: ship
description: Take a merged change to users - deploy, cut a release, publish a package. Use when Vasu asks to deploy, release, cut a version, or asks how a change reaches users.
---

# Ship

```
## Ship in project rules ──> the trunk, clean, fetched ──> trigger ──> watch the run ──> verify live ──> report
        │
        └── no section: read the workflows and scripts, write it with product-context, then go on
```

## 1 — How this project ships

Read `## Ship` in the project rule file. No section: read `.github/workflows/*.yml` for the trigger, `scripts/` and `package.json` for a deploy or publish command, then load `product-context` and write the section. Vasu asked "How do I deploy this?" in eight sessions of one project. Once written, nobody asks again.

| The trigger | The command |
|---|---|
| a `v*` tag | `git tag -a v<X.Y.Z> -m v<X.Y.Z> && git push origin v<X.Y.Z>` |
| `workflow_dispatch` | `gh workflow run <file> [-f key=value]` |
| a script | run it, from the trunk |
| a platform CLI | `wrangler deploy`, `vercel --prod`, the project's words |

## 2 — From the trunk, clean, fetched

```bash
git switch <trunk> && git fetch origin && git status -sb    # "behind" or dirty: stop and say so
git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~20)..HEAD
```

The log is what ships. Read it. A change Vasu did not name in the ask is still going out: list it.

The version: Vasu names the bump, or the log decides. A breaking change is major, a feature is minor, a fix is patch. Packages that version together, version together.

## 3 — Watch the run

```bash
gh run list --workflow <file> -L 1 --json databaseId,status --jq '.[0].databaseId'
gh run watch <id> --exit-status --compact
gh run view <id> --log-failed                              # red: read this before you touch anything
```

A platform deploy log: `npx vercel inspect <url> --logs --scope <team>`. The scope is the line that fails first. Put it in `## Ship`.

## 4 — Verify live

The run is green. That is not the claim. The claim is that users get the change. Hit the URL, the health route, the package registry: `npm view <pkg> version`, `curl -sI <url>`.

## Report

The version, the URL, what shipped as the log listed it, and what to do by hand where the pipeline does not reach. A red run: the failing step, the log line, and what you believe.

## Never

- Ship from a branch, a dirty tree, or a trunk that is behind origin.
- Retry a red deploy without reading its log.
- Ship a version that skips one the registry already has.
