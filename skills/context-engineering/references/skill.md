# Skill

The frontmatter past `name` and `description`, the substitutions, and what runs before Claude reads the body.

## Frontmatter

| Field | Sets |
|---|---|
| `argument-hint` | the hint in the `/` menu: `[--workers <n>] [--map <n>]` |
| `arguments` | names for the positions: `arguments: [issue, branch]` gives `$issue`, `$branch` |
| `disable-model-invocation: true` | user-invoked. No description in context, no preload into a subagent |
| `user-invocable: false` | model-invoked only. Hidden from the `/` menu |
| `when_to_use` | more trigger text, appended to the description. Both together are cut at 1,536 characters |
| `allowed-tools` | tools that run without a prompt while the skill is active: `Bash(${CLAUDE_SKILL_DIR}/scripts/*)` |
| `disallowed-tools` | tools pulled from the pool while it is active: `AskUserQuestion` for a loop that must not stop |
| `model`, `effort` | an override for the rest of the turn |
| `context: fork` | the body runs as its own worker. `agent:` picks the type. `background: false` waits for it |
| `hooks` | hooks that live for the session once the skill fires |
| `paths` | fire on its own only when Claude works in a matching file: `src/api/**/*.ts` |

The description and `when_to_use` share one budget, and the key trigger goes first. A long tail is cut, not read.

## Substitutions

Replaced in the body before Claude reads it.

| Variable | Is |
|---|---|
| `$ARGUMENTS`, `$0`, `$1` | what you typed after the name, whole or by position |
| `${CLAUDE_SKILL_DIR}` | the directory of this `SKILL.md`. In a plugin, the skill's own subdirectory |
| `${CLAUDE_PROJECT_DIR}` | the project root |
| `${CLAUDE_PLUGIN_ROOT}` | the plugin root. Plugin skills only. For a file shared between skills |
| `${CLAUDE_SESSION_ID}` | the session, for a log or a scratch file |

`${CLAUDE_SKILL_DIR}` is the one to path a script with. It is the same word in the body and in `allowed-tools`, so the grant matches the call.

## Runs before Claude reads

`` !`command` `` at the start of a line runs the command and puts its output where the line was, every time the skill fires.

```
!`git diff HEAD`        every run of a commit skill needs the diff. Inject it.
!`cat README.md`        only some runs need it. A pointer, not an injection.
```

Path it with `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PROJECT_DIR}`. The shell's `cwd` moves with every `cd`.

## Lifecycle

- Claude reads the body once, when the skill fires, and never again in that task. Write standing instructions, not one-time steps.
- After a compaction the invoked skills come back, up to one budget across all of them. A long skill crowds the others out.
- `.claude/commands/<name>.md` is a skill with no directory. Write the skill.
- In a plugin the name is `<plugin>:<skill>`. `claude plugin validate <path>` checks the manifest and the tree.
