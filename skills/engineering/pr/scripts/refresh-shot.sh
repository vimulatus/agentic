#!/bin/sh
# Re-upload a screenshot under the current sha and swap its URL in the PR body.
#   refresh-shot.sh <pr> <task> <file> [sha]
# The old URL keeps working, so a reviewer part way through the body keeps the picture.
set -eu
pr=${1:?usage: refresh-shot.sh <pr> <task> <file> [sha]}
task=${2:?task slug}
file=${3:?path to the new shot}
sha=${4:-$(git rev-parse --short HEAD)}

base=$(basename "$file"); stem=${base%.*}; ext=${base##*.}
url=$(fs put "$file" --bucket evidence --key "$task/$stem-$sha.$ext")

body=$(mktemp)
gh pr view "$pr" --json body --jq .body > "$body"
if ! grep -qE "https://[^ )\"]*/$task/$stem[^ )\"]*\.$ext" "$body"; then
  echo "no $task/$stem.$ext URL in the body of #$pr. Uploaded to $url — embed it yourself." >&2
  exit 1
fi
sed -E -i.bak "s#https://[^ )\"]*/$task/$stem[^ )\"]*\.$ext#$url#g" "$body"
gh pr edit "$pr" --body-file "$body"
echo "$url"
