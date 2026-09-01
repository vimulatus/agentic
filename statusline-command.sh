#!/usr/bin/env bash
input=$(cat)

R=$'\033[0m'; DIM=$'\033[2m'; B=$'\033[1m'
GRN=$'\033[38;5;114m'; YEL=$'\033[38;5;179m'; RED=$'\033[38;5;174m'
CYA=$'\033[38;5;110m'; MAG=$'\033[38;5;140m'; GRY=$'\033[38;5;245m'

CACHE_TTL=5
SEP=" ${DIM}│${R} "

IFS=$'\t' read -r cur_dir session_id used five_h five_r seven_d seven_r < <(
  printf '%s' "$input" | jq -r '[
    (.workspace.current_dir // .cwd // ""),
    (.session_id // "nosession"),
    (.context_window.used_percentage // -1 | tostring),
    (.rate_limits.five_hour.used_percentage // -1 | tostring),
    (.rate_limits.five_hour.resets_at // "" | tostring),
    (.rate_limits.seven_day.used_percentage // -1 | tostring),
    (.rate_limits.seven_day.resets_at // "" | tostring)
  ] | @tsv'
)
[ -n "$cur_dir" ] || cur_dir=$PWD

# ---------- git, cached per session ----------
cache=/tmp/statusline-git-$session_id
stale() {
  [ ! -f "$cache" ] || \
  [ $(( $(date +%s) - $(stat -c %Y "$cache" 2>/dev/null || stat -f %m "$cache" 2>/dev/null || echo 0) )) -gt $CACHE_TTL ]
}
if stale; then
  if git -C "$cur_dir" --no-optional-locks rev-parse --git-dir >/dev/null 2>&1; then
    branch=$(git -C "$cur_dir" --no-optional-locks branch --show-current 2>/dev/null)
    [ -n "$branch" ] || branch=$(git -C "$cur_dir" --no-optional-locks rev-parse --short HEAD 2>/dev/null)
    staged=$(git -C "$cur_dir" --no-optional-locks diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
    modified=$(git -C "$cur_dir" --no-optional-locks diff --name-only 2>/dev/null | wc -l | tr -d ' ')
    gd=$(git -C "$cur_dir" --no-optional-locks rev-parse --git-dir 2>/dev/null)
    gc=$(git -C "$cur_dir" --no-optional-locks rev-parse --git-common-dir 2>/dev/null)
    wt=""
    [ "$gd" != "$gc" ] && wt=$(basename "$(cd "$cur_dir" && cd "$gc/.." && pwd 2>/dev/null)")
    printf '%s\t%s\t%s\t%s\n' "$branch" "$staged" "$modified" "$wt" > "$cache"
  else
    printf '\t\t\t\n' > "$cache"
  fi
fi
IFS=$'\t' read -r branch staged modified wt < "$cache"

# ---------- dir [worktree] │ branch +staged ~modified ----------
line="${MAG}${B}${cur_dir##*/}${R}"
[ -n "$wt" ] && line+=" ${YEL}⑂${R}${DIM}${wt}${R}"
if [ -n "$branch" ]; then
  line+="${SEP}${CYA}${branch}${R}"
  [ "${staged:-0}" -gt 0 ] 2>/dev/null && line+=" ${GRN}+${staged}${R}"
  [ "${modified:-0}" -gt 0 ] 2>/dev/null && line+=" ${YEL}~${modified}${R}"
fi

# ---------- context ----------
if [ "${used%%.*}" -ge 0 ] 2>/dev/null; then
  pct=${used%%.*}
  if   [ "$pct" -lt 50 ]; then c=$GRN
  elif [ "$pct" -lt 80 ]; then c=$YEL
  else c=$RED; fi
  line+="${SEP}${GRY}ctx${R} ${c}${pct}%${R}"
else
  line+="${SEP}${GRY}ctx${R} ${DIM}--${R}"
fi

# ---------- rate limits: label, used, time until reset ----------
# resets_at arrives as epoch seconds, or as an ISO 8601 string. Read both.
to_epoch() {
  local s=$1
  case "$s" in
    ''|null) return 1 ;;
    *[!0-9]*)
      s=${s%%.*}; s=${s%%+*}; s=${s%Z}
      date -j -u -f "%Y-%m-%dT%H:%M:%S" "$s" +%s 2>/dev/null \
        || date -u -d "$1" +%s 2>/dev/null \
        || return 1 ;;
    *) printf '%s' "$s" ;;
  esac
}
countdown() {
  local at rem d h m
  at=$(to_epoch "$1") || return 1
  rem=$(( at - $(date +%s) ))
  [ "$rem" -le 0 ] && { printf 'now'; return 0; }
  d=$(( rem / 86400 )); h=$(( rem % 86400 / 3600 )); m=$(( rem % 3600 / 60 ))
  if   [ "$d" -gt 0 ]; then printf '%dd%dh' "$d" "$h"
  elif [ "$h" -gt 0 ]; then printf '%dh%dm' "$h" "$m"
  else printf '%dm' "$m"; fi
}
limit() { # $1 label  $2 used  $3 resets_at
  local v=${2%%.*} c t
  line+="${SEP}${GRY}${1}${R} "
  if [ "$v" -ge 0 ] 2>/dev/null; then
    if   [ "$v" -lt 50 ]; then c=$GRN
    elif [ "$v" -lt 80 ]; then c=$YEL
    else c=$RED; fi
    line+="${c}${v}%${R}"
  else
    line+="${DIM}--${R}"
  fi
  t=$(countdown "$3") && line+=" ${DIM}↻${t}${R}"
}
limit "5h" "$five_h" "$five_r"
limit "7d" "$seven_d" "$seven_r"

printf '%s\n' "$line"
