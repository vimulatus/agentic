---
name: release
description: Bump the plugin version, commit, tag and push, so every project picks the change up.
argument-hint: "[major|minor|patch]"
disable-model-invocation: true
---

Commit the work first, one logical change per commit. Then run `${CLAUDE_SKILL_DIR}/../../../scripts/release.sh $ARGUMENTS`. No argument means minor.

A skill change is minor. A fix inside a skill is patch. A skill removed or renamed is major.
