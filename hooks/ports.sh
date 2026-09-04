#!/usr/bin/env bash
# The listeners this session started, and nobody else's.
#   Stop        -> names them as additionalContext, so the done report carries them
#   SessionEnd  -> stops them
# A listener is ours when one of two proofs holds. Anything else is Vasu's or another session's and is never touched.
#   1. its environment carries CLAUDE_CODE_SESSION_ID=<this session>   (every Bash tool child inherits it)
#   2. its parent chain reaches this session's claude process           (a background job the harness still holds)
# Proof 2 binds to the claude process that ran this hook, which is the session's own. Run by hand from another
# session, proof 2 answers for that session: test it with a foreign session_id only from the harness.
# An Apple system binary hides its environment from ps, so one of those, once reparented to launchd, is
# left alone. A false negative, never a false positive.
set -u
payload=$(cat)
sid=$(jq -r '.session_id // ""' <<<"$payload" 2>/dev/null)
event=$(jq -r '.hook_event_name // ""' <<<"$payload" 2>/dev/null)
[ -n "$sid" ] || exit 0

# this session's claude process: the nearest ancestor of this hook named claude
claude_pid=${CLAUDE_PID:-}
if [ -z "$claude_pid" ]; then
  p=$$
  while [ "$p" -gt 1 ]; do
    [ "$(ps -o comm= -p "$p" 2>/dev/null)" = claude ] && { claude_pid=$p; break; }
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' '); [ -n "$p" ] || break
  done
fi

env_has_sid() {
  if [ -r "/proc/$1/environ" ]; then tr '\0' '\n' < "/proc/$1/environ"
  else ps -E -o command= -p "$1" 2>/dev/null | tr ' ' '\n'; fi | grep -qx "CLAUDE_CODE_SESSION_ID=$sid"
}
descends_from_claude() {
  [ -n "$claude_pid" ] || return 1
  local p=$1
  while [ -n "$p" ] && [ "$p" -gt 1 ]; do
    [ "$p" = "$claude_pid" ] && return 0
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
  done
  return 1
}

mine=""
while IFS=$'\t' read -r pid port cmd; do
  [ -n "$pid" ] || continue
  env_has_sid "$pid" || descends_from_claude "$pid" || continue
  mine="$mine$pid $port $cmd"$'\n'
done < <(lsof -nP -iTCP -sTCP:LISTEN -Fpcn 2>/dev/null | awk '
  /^p/{pid=substr($0,2)} /^c/{cmd=substr($0,2)}
  /^n/{port=$0; sub(/.*:/,"",port); if(!((pid SUBSEP port) in s)){s[pid SUBSEP port]=1; printf "%s\t%s\t%s\n", pid, port, cmd}}')

[ -n "$mine" ] || exit 0

case "$event" in
  Stop)
    list=$(printf '%s' "$mine" | awk '{printf "%s%s on :%s (pid %s)", (NR>1?", ":""), $3, $2, $1}')
    jq -n --arg t "Still running from this session: $list. Stop what the task no longer needs, and name what you leave up in the report." \
      '{hookSpecificOutput:{hookEventName:"Stop",additionalContext:$t}}' ;;
  SessionEnd)
    printf '%s' "$mine" | awk '{print $1}' | sort -u | xargs kill 2>/dev/null ;;
esac
exit 0
