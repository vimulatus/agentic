#!/bin/sh
# Emit one line per issue that enters the queue. Takes the queue-list.sh flags.
# For the Monitor tool, persistent: true.
set -u
here=$(dirname "$0")
seen=$(mktemp)
"$here/queue-list.sh" "$@" | cut -f1 > "$seen"
while true; do
  sleep 60
  open=$("$here/queue-list.sh" "$@" 2>/dev/null) || continue
  printf '%s\n' "$open" | while IFS="$(printf '\t')" read -r n t; do
    if [ -n "$n" ] && ! grep -qx "$n" "$seen"; then
      echo "new issue #$n: $t"
      echo "$n" >> "$seen"
    fi
  done
done
