# Subagent

A **worker**: its own context, its own loop, one return. It cannot see the conversation that spawned it.

Reach for it when a read would flood your context, when tasks do not touch each other, or when a worker needs fixed instructions every time. The `orchestrate` skill runs more than one.

## The file

`agents/<name>.md` in the plugin, `.claude/agents/` in a project, `~/.claude/agents/` for every project. The body is the worker's whole system prompt.

| Field | Sets |
|---|---|
| `name` | the type you pass to `Agent` |
| `description` | the trigger, in the skill form: what it does, when to reach for it, the near miss |
| `tools`, `disallowedTools` | the tool pool. Omit `tools` for everything |
| `skills` | skills loaded **whole** at launch, not on demand. Each one costs its full body every spawn |
| `model` | a model, or `inherit` |
| `permissionMode` | `default`, `acceptEdits`, `plan`, `bypassPermissions` |
| `isolation: worktree` | its own checkout. Two workers in one tree overwrite each other |
| `memory` | `user`, `project` or `local`: its own auto memory across sessions |
| `maxTurns` | a ceiling on the loop |
| `hooks` | hooks that live while it runs |

A skill with `disable-model-invocation: true` cannot go in `skills:`. Make it model-invoked, or inline the lines.

## What the worker sees

| Sees | Does not see |
|---|---|
| its body, as the system prompt | the conversation |
| the brief you pass | your output style |
| `CLAUDE.md` and `git status` | your auto memory, unless it has `memory:` |
| the `skills:` bodies, whole | |
| every other skill's description, to fire on its own | |

The brief is all it gets. Write the body for a stranger: the one task, where to read the spec, what to return.

## Two ways to fork

| | The worker gets |
|---|---|
| `Agent` with a type, or a skill with `context: fork` | a fresh context. The body or the skill is the whole prompt |
| `Agent` with `subagent_type: "fork"` | your conversation so far, your system prompt, your tools |

`context: fork` needs a skill with a task in it. A guideline skill forks into a worker with nothing to do.

```
Worked: agents/dev.md

  description  Take one issue or one bite-sized task from a cold start to an open PR.
               Use when a skill hands you a ticket, a bug, or a chore to build.
               Not for a spec, which wayfinder cuts first.
  skills       coding, red-green, unslop, pr      loaded whole, every spawn
  body         "You cannot see the conversation that spawned you. The brief is
               all you get, and the issue is the spec."
  return       the PR URL and its base, one line on what it does, the check
```

## The return

Name the artifact in the body. A worker that returns a summary instead of a PR was told to.

Verify by spawning it with the brief and nothing else. It returns the artifact, or it names the wall. A question back is a hole in the body.
