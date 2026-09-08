#!/bin/sh
# Run the gate with the machine's gate lock held. One worker in the gate at a time.
#   gate-lock.sh npm test
set -eu
lock=/tmp/agentic-gate.lock
until mkdir "$lock" 2>/dev/null; do
  # a lock with nothing in the gate for 30 minutes belonged to a worker that died
  [ -n "$(find "$lock" -maxdepth 0 -mmin +30 2>/dev/null)" ] && rmdir "$lock" 2>/dev/null
  sleep 5
done
trap 'rmdir "$lock" 2>/dev/null || true' EXIT INT TERM
"$@"
