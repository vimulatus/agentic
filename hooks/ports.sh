#!/usr/bin/env bash
# The listeners this session started, and nobody else's.
#   Stop        -> reminds the model about remaining listeners using its runtime's output contract
#   SessionEnd  -> stops them
# A listener is ours when its parent chain says a tool call started it. Anything else is Vasu's, an MCP
# server's or another session's, and is never touched.
#   chain reaches this session's claude or codex -> ours when a shell sits directly under it. A tool call runs
#     through a shell; a stdio MCP server is the configured command itself, and drops out with its children.
#     One residual: an MCP server configured as `sh -c ...` still reads as ours.
#   chain broke at launchd (nohup, disown) -> ours when its environment carries this runtime's session id.
# The environment alone proves nothing: claude exports the session id into its MCP servers too.
# The chain binds to the runtime process that ran this hook, which is the session's own. Run by hand from
# another session, it answers for that session: test it with a foreign session_id only from the harness.
# An Apple system binary hides its environment from ps, so one of those, once reparented to launchd, is
# left alone. A false negative, never a false positive.
# A subagent runs inside this runtime process, so its listeners read as ours too. The one mark it leaves
# is its worktree: a listener whose cwd sits under a runtime-managed worktree is that agent's while the worktree stands,
# and Stop leaves it out of the list. SessionEnd stops it with the rest.
# Stop speaks only when the set of pid:port pairs differs from the last Stop. The set lives in
# $TMPDIR/vimulatus/ports/<session_id>; SessionEnd removes it.
set -u
payload=$(cat)
sid=$(jq -r '.session_id // ""' <<<"$payload" 2>/dev/null)
event=$(jq -r '.hook_event_name // ""' <<<"$payload" 2>/dev/null)
[ -n "$sid" ] || exit 0
cache="${TMPDIR:-/tmp}/vimulatus/ports/$sid"

# This session's runtime process: the nearest ancestor of this hook named claude or codex.
runtime_pid=${CLAUDE_PID:-}
if [ -z "$runtime_pid" ]; then
  p=$$
  while [ "$p" -gt 1 ]; do
    comm=$(ps -o comm= -p "$p" 2>/dev/null)
    case "${comm##*/}" in claude|codex|codex-*) runtime_pid=$p; break ;; esac
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' '); [ -n "$p" ] || break
  done
fi

env_has_sid() {
  if [ -r "/proc/$1/environ" ]; then tr '\0' '\n' < "/proc/$1/environ"
  else ps -E -o command= -p "$1" 2>/dev/null | tr ' ' '\n'; fi \
    | grep -Eq "^(CLAUDE_CODE_SESSION_ID|CODEX_SESSION_ID|CODEX_THREAD_ID)=$sid$"
}
started_by_this_session() {
  local p=$1 prev="" comm
  if [ -n "$runtime_pid" ]; then
    while [ -n "$p" ] && [ "$p" -gt 1 ]; do
      if [ "$p" = "$runtime_pid" ]; then
        comm=$(ps -o comm= -p "$prev" 2>/dev/null)
        case "${comm##*[-/]}" in sh|bash|zsh|dash|ksh|fish) return 0 ;; *) return 1 ;; esac
      fi
      prev=$p
      p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
    done
  fi
  env_has_sid "$1"
}
in_live_worktree() {
  local cwd
  cwd=$(lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  case "$cwd" in */.claude/worktrees/agent-*|*/.codex/worktrees/*) [ -d "$cwd" ] && return ;; esac
  [ -n "${CODEX_HOME:-}" ] || return 1
  case "$cwd" in "$CODEX_HOME"/worktrees/*) [ -d "$cwd" ] ;; *) return 1 ;; esac
}

mine=""
while IFS=$'\t' read -r pid port cmd; do
  [ -n "$pid" ] || continue
  started_by_this_session "$pid" || continue
  [ "$event" = Stop ] && in_live_worktree "$pid" && continue
  mine="$mine$pid $port $cmd"$'\n'
done < <(lsof -nP -iTCP -sTCP:LISTEN -Fpcn 2>/dev/null | awk '
  /^p/{pid=substr($0,2)} /^c/{cmd=substr($0,2)}
  /^n/{port=$0; sub(/.*:/,"",port); if(!((pid SUBSEP port) in s)){s[pid SUBSEP port]=1; printf "%s\t%s\t%s\n", pid, port, cmd}}')

case "$event" in
  Stop)
    now=$(printf '%s' "$mine" | awk '{print $1":"$2}' | sort)
    [ "$now" = "$(cat "$cache" 2>/dev/null)" ] && exit 0
    mkdir -p "${cache%/*}" && printf '%s\n' "$now" > "$cache"
    [ -n "$mine" ] || exit 0
    list=$(printf '%s' "$mine" | awk '{printf "%s%s on :%s (pid %s)", (NR>1?", ":""), $3, $2, $1}')
    jq -n --arg runtime "${PLUGIN_ROOT:-}" \
      --arg t "Still running from this session: $list. Stop what the task no longer needs, and name what you leave up in the report." \
      'if $runtime != "" then {decision:"block",reason:$t}
       else {hookSpecificOutput:{hookEventName:"Stop",additionalContext:$t}} end' ;;
  SessionEnd)
    printf '%s' "$mine" | awk '{print $1}' | sort -u | xargs kill 2>/dev/null
    rm -f "$cache" ;;
esac
exit 0
