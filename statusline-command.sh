#!/usr/bin/env bash
input=$(cat)

# Git branch
branch=$(git -C "$(echo "$input" | jq -r '.workspace.current_dir')" --no-optional-locks branch --show-current 2>/dev/null)

# Context usage
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')
window_size=$(echo "$input" | jq -r '.context_window.context_window_size // empty')

# Build context string
if [ -n "$used" ] && [ -n "$window_size" ]; then
  used_int=${used%.*}
  remaining_int=${remaining%.*}
  # Compute used tokens from percentage
  tokens_k=$(awk "BEGIN { printf \"%.1fK\", ($used / 100) * $window_size / 1000 }")
  window_k=$(awk "BEGIN { printf \"%.0fK\", $window_size / 1000 }")
  context_str="${tokens_k}/${window_k} (${used_int}% used)"
elif [ -n "$used" ]; then
  used_int=${used%.*}
  context_str="${used_int}% used"
else
  context_str="no messages yet"
fi

# Output
if [ -n "$branch" ]; then
  printf "\033[0;36m%s\033[0m  \033[0;33mctx: %s\033[0m" "$branch" "$context_str"
else
  printf "\033[0;33mctx: %s\033[0m" "$context_str"
fi
