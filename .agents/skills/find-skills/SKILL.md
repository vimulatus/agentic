---
name: find-skills
description: Find and install agent skills when Vasu asks for a skill, a reusable workflow, or an extension to the agent's capabilities.
---

# Find skills

Check the [skills.sh leaderboard](https://skills.sh/) for a relevant established option, then search for the specific task when it is not covered:

```bash
npx skills find [query] [--owner <owner>]
```

Inspect the candidate's instructions, relevant resources, source and maintenance before recommending it. Judge whether it fits the task and current runtime. Popularity is context, not proof of quality; fetch current install counts or stars only when they help the choice.

Present the suitable skill, why it fits, its source link and installation command. Prefer official sources when comparable options meet the need. If no suitable skill exists, say what was searched and continue the requested task with available capabilities. Use `create-skill` when Vasu wants a new reusable workflow.

## Install

Install when Vasu requests it. Match the requested scope; `-g` installs at user level and `-y` skips the CLI confirmation prompt:

```bash
npx skills add <owner/repo@skill> -g -y
```

Omit `-g` for a project installation. `npx skills update` updates installed skills; use it when updates are requested.
