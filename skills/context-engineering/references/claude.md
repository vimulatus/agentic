# Claude Code authoring

Use this reference for Claude Code configuration. Shared skill bodies carry the workflow; put Claude-only instructions in a reference read only on that client.

| Need | Claude Code home or mechanism |
|---|---|
| Project and global instructions | `CLAUDE.md` and `~/.claude/CLAUDE.md` |
| File-scoped rules | `.claude/rules/<topic>.md` with `paths:` |
| User-only skill invocation | `disable-model-invocation: true` in skill frontmatter |
| Skill arguments | `$ARGUMENTS` or positional substitutions in the skill body |
| Skill-relative resources | `${CLAUDE_SKILL_DIR}` substitution; shared examples instead resolve the loaded skill's absolute directory |
| Tool grants | `allowed-tools` with Claude tool names and permission syntax |
| Task skill running as a worker | `context: fork` and the appropriate `agent:` type |
| Named workers | `agents/<name>.md` in a plugin, `.claude/agents/` in a project |

Worker frontmatter can select tools, skills, model and isolation. A regular worker needs a self-contained brief; use conversation inheritance only when the available spawning tool explicitly supports it. Writing workers use a worktree. Read the current tool contract before assuming how a worker resumes or stops.

For syntax beyond these cases, read the official [skills](https://code.claude.com/docs/en/skills), [memory](https://code.claude.com/docs/en/memory), or [subagents](https://code.claude.com/docs/en/sub-agents) documentation. Keep the house choice in the skill, rather than copying the field catalog.

## Hooks

Register plugin hooks in `hooks/hooks.json`; project and user hooks live in `.claude/settings.json` and `~/.claude/settings.json`. Path plugin handlers with `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh`.

Use the supported event and output schema from the [hook contract](https://code.claude.com/docs/en/hooks). A shared handler filters the command itself, even when Claude's `if` field already narrows it; the other client may not apply that field.

The plugin's Claude name is `vimulatus`. Use the discovered skill name when invoking it; hook prose can name the skill without a client namespace.
