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
