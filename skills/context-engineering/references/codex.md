# Codex authoring

Use this reference for Codex configuration. Shared skill bodies carry the workflow; put Codex-only instructions in a reference read only on that client.

| Need | Codex home or mechanism |
|---|---|
| Project and global instructions | `AGENTS.md` and `${CODEX_HOME:-$HOME/.codex}/AGENTS.md` |
| Directory-specific instructions | An `AGENTS.md` in the applicable directory, according to the client's instruction discovery rules |
| Skills | `SKILL.md` with `name` and `description`; repo maintenance skills here live in `.agents/skills/` |
| Invocation policy | `agents/openai.yaml`, with `policy.allow_implicit_invocation: false` for an explicitly invoked skill |
| Skill-relative resources | Resolve the directory from the skill path supplied by the catalog; use absolute paths |
| Arguments | Read the user's request and fill command arguments explicitly; do not rely on Claude body substitutions |
| Workers | Use the available delegation tool and its documented arguments; pass the role brief and required skills explicitly |

Preserve existing invocation policy when porting. Claude frontmatter such as `allowed-tools` or `context: fork` does not establish a Codex permission grant or launch a worker here. Configure Codex-specific metadata separately; a skill does not override the client's permissions.

Resolve tool names, context inheritance and worker isolation from the active tool descriptions. This repository's Markdown worker roles are reusable briefs; their Claude registration frontmatter is not a Codex agent registration. Share the brief, configure the client separately.

For additional configuration, read the current official [skills](https://developers.openai.com/codex/skills/), [project instructions](https://developers.openai.com/codex/guides/agents-md), or [subagents](https://developers.openai.com/codex/subagents/) documentation. Do not copy a Claude configuration file and rename its paths.

## Hooks

Register plugin hooks in `hooks/hooks.json`; follow the current [Codex hook contract](https://learn.chatgpt.com/docs/hooks) for project and user locations, events, matching and output.

Codex requires new or changed non-managed hook definitions to be reviewed and trusted through `/hooks`. A registered but untrusted hook does not run. Shared command handlers repeat their command filter because Codex does not support Claude's `if` field.

For shared plugin hook commands, `${CLAUDE_PLUGIN_ROOT}` is an existing compatibility variable; Codex also supplies `PLUGIN_ROOT`. This hook compatibility does not establish skill-body substitution support.

The plugin's Codex name is `default`. Use the discovered skill name when invoking it; hook prose can name the skill without a client namespace.
