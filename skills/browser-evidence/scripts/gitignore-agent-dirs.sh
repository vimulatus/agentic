#!/bin/sh
# Keep .agent-auth/ and .agent-evidence/ out of git. Idempotent. Run once per task.
set -eu
ignore="$(git rev-parse --show-toplevel)/.gitignore"
[ -s "$ignore" ] && [ -n "$(tail -c1 "$ignore")" ] && echo >> "$ignore"   # keep the last rule intact
for d in .agent-auth/ .agent-evidence/; do
  grep -qxF "$d" "$ignore" 2>/dev/null || echo "$d" >> "$ignore"
done
