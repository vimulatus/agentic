#!/usr/bin/env bash
input=$(cat)

R=$'\033[0m'; DIM=$'\033[2m'; B=$'\033[1m'
GRN=$'\033[38;5;114m'; YEL=$'\033[38;5;179m'; RED=$'\033[38;5;174m'
CYA=$'\033[38;5;110m'; MAG=$'\033[38;5;140m'; GRY=$'\033[38;5;245m'

LEFTW=58        # column where the usage gutter starts
CACHE_TTL=5

IFS=$'\t' read -r cur_dir session_id used win_size five_h seven_d < <(
  printf '%s' "$input" | jq -r '[
    (.workspace.current_dir // .cwd // ""),
    (.session_id // "nosession"),
    (.context_window.used_percentage // -1 | tostring),
    (.context_window.context_window_size // 0 | tostring),
    (.rate_limits.five_hour.used_percentage // -1 | tostring),
    (.rate_limits.seven_day.used_percentage // -1 | tostring)
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

# ---------- line 1 left: dir [worktree] | branch +staged ~modified ----------
p1="${cur_dir##*/}"; l1="${MAG}${B}${p1}${R}"
if [ -n "$wt" ]; then
  p1+=" ⑂$wt"; l1+=" ${YEL}⑂${R}${DIM}${wt}${R}"
fi
if [ -n "$branch" ]; then
  p1+="  │  $branch"; l1+="  ${DIM}│${R}  ${CYA}${branch}${R}"
  [ "${staged:-0}" -gt 0 ] 2>/dev/null && { p1+=" +$staged"; l1+=" ${GRN}+${staged}${R}"; }
  [ "${modified:-0}" -gt 0 ] 2>/dev/null && { p1+=" ~$modified"; l1+=" ${YEL}~${modified}${R}"; }
fi

# ---------- line 2 left: context bar ----------
if [ "${used%%.*}" -ge 0 ] 2>/dev/null && [ "${win_size%%.*}" -gt 0 ] 2>/dev/null; then
  tok=$(awk "BEGIN{printf \"%d\", ($used/100)*$win_size}")
  pct=${used%%.*}
  if   [ "$tok" -lt 150000 ]; then c=$GRN
  elif [ "$tok" -le 320000 ]; then c=$YEL
  else c=$RED; fi
  filled=$(( pct * 12 / 100 )); [ $filled -gt 12 ] && filled=12
  bar=""; for ((i=0;i<12;i++)); do [ $i -lt $filled ] && bar+="█" || bar+="░"; done
  tokk=$(awk "BEGIN{printf \"%.1fK\", $tok/1000}")
  wink=$(awk "BEGIN{printf \"%dK\", $win_size/1000}")
  p2="$bar $tokk/$wink ${pct}%"
  l2="${c}${bar}${R} ${c}${tokk}${R}${DIM}/${wink}${R} ${c}${pct}%${R}"
else
  p2="░░░░░░░░░░░░ no messages yet"
  l2="${DIM}░░░░░░░░░░░░ no messages yet${R}"
fi

# ---------- right gutter: rate limits ----------
limit_color() {
  local v=${1%%.*}
  if   [ "$v" -lt 50 ]; then printf '%s' "$GRN"
  elif [ "$v" -lt 80 ]; then printf '%s' "$YEL"
  else printf '%s' "$RED"; fi
}
gutter() { # $1 label  $2 value
  if [ "${2%%.*}" -ge 0 ] 2>/dev/null; then
    printf '%s\t%s' "$1 ${2%%.*}%" "${GRY}${1}${R} $(limit_color "$2")${2%%.*}%${R}"
  else
    printf '%s\t%s' "$1   --" "${GRY}${1}${R} ${DIM}--${R}"
  fi
}
IFS=$'\t' read -r g1p g1c < <(gutter "5h" "$five_h")
IFS=$'\t' read -r g2p g2c < <(gutter "7d" "$seven_d")

pad() { local n=$(( LEFTW - ${#1} )); [ $n -lt 2 ] && n=2; printf '%*s' $n ''; }

printf '%s%s%s\n' "$l1" "$(pad "$p1")" "$g1c"
printf '%s%s%s\n' "$l2" "$(pad "$p2")" "$g2c"
