---
name: release
description: Bump the plugin version, commit, tag and push, so every project picks the change up.
---

Commit the work first, one logical change per commit. Resolve the repository root three directories above this loaded `SKILL.md` directory. Run its `scripts/release.sh` by absolute path, passing the user's `major`, `minor`, or `patch` argument explicitly. No argument means minor.

A skill change is minor. A fix inside a skill is patch. A skill removed or renamed is major.
