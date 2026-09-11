# Vimulatus

Vasu's personal skills and agent workflows for Claude Code and Codex. The `new` branch is the release channel for both clients.

## Claude Code

```text
/plugin marketplace add vimulatus/agentic@new
/plugin install default@vimulatus-personal
```

## Codex

```sh
codex plugin marketplace add vimulatus/agentic --ref new
codex plugin add default@vimulatus-personal
```

Start a new session after installing or upgrading so the client loads the current skills. In Codex CLI, open `/hooks` and trust the plugin hooks after reviewing them; Codex skips new or changed hook definitions until you do.

## Skills

Categories organize the source; skill names and invocation remain the same.

| Category | Skills |
|---|---|
| [Engineering](skills/engineering) | architecture, blacksmith, browser-evidence, bug-hunt, coding, context-engineering, orchestrate, pr, red-green, review, ship, unslop |
| [Productivity](skills/productivity) | copy, grilling, handoff, handout, issue-queue, product-context, prototype, research, slc, status, taste, to-tickets, wayfinder |
| [Misc](skills/misc) | eli5, teach |

Repo-maintenance skills stay in `.agents/skills/` and `.claude/skills/`.

Run `python3 scripts/test-skill-layout.py` after moving skills or changing discovery paths. It checks category layout, matching client inventories, and relative Markdown links. The existing hook-routing and PR-watcher checks cover their skill references and commands.
