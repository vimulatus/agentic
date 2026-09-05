# Vimulatus

## Product

Vasu's personal skills, hooks and agent workflows for Claude Code and Codex, shared across his projects.

? **Stage:** In active personal use; evolve quickly, with care for changes that affect every project loading the plugin.

- **Users** — Vasu and the agents working with him across projects.
- **Works when** — the right workflow fires from an ordinary request and carries the work through without Vasu repeating his preferences.
- ? **Non-goals** — a general-purpose framework or workflows for a wider audience; default to Vasu's needs.

## Ship

- **Run** — this is a plugin, with no app server or port. Install using `README.md` and start a new client session to load changes. Codex CLI requires reviewing and trusting new or changed hooks in `/hooks`.
- **Gate** — no automated test suite or CI is configured. Run `git diff --check`; exercise a changed skill in a fresh session with an ordinary request, and exercise changed hooks or scripts on their relevant inputs. Check changes in both clients when they affect shared behavior.
- **Ship** — `new` is the release channel for both clients. Load the repo-local `release` skill for releases; `scripts/release.sh` bumps both manifests, commits, tags `v<version>` and pushes. It requires a clean tree on `new`; `sh scripts/release.sh patch -n` previews a patch release without publishing.

## Glossary

| Term | Meaning |
|---|---|
| Project Rule files | Root-level `CLAUDE.md` and `AGENTS.md`. |
| Global Rule files | `codex/AGENTS.md` and `claude/CLAUDE.md`. |
| Rule files | Usually the Global Rule files; sometimes also the Project Rule files, depending on context. |

## Working here

- Keep root `AGENTS.md` and `CLAUDE.md` equivalent; each client must receive the same project context.
- `codex/AGENTS.md` and `claude/CLAUDE.md` hold Vasu's global preferences. Root files hold this repo's context; put cross-project preferences in the global files or the skill that owns them.
- Edit the source in this repo. Installed plugin caches are release outputs.
- Use `context-engineering` for instruction changes and `product-context` for the Product and Ship sections. Keep workflow procedures in their owning skills.
- `.agents/skills/` and `.claude/skills/` contain repo-maintenance skills; `skills/` contains the workflows distributed to other projects. Preserve that distinction when adding a skill.
- Shared skill or hook changes can affect every project loading the plugin. Verify runtime-specific assumptions in Claude Code and Codex.
- Keep the versions in `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` aligned. Their plugin names intentionally differ; preserve the marketplace install name `default@vimulatus-personal`.
