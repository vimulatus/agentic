#!/bin/sh
# Print the open issues in the queue, one "<number>\t<title>" per line.
#   --map <n>   the open tickets under map issue #n
#   no flag     the open issues with no parent
set -eu

map=""
while [ $# -gt 0 ]; do
  case "$1" in
    --map)
      [ $# -ge 2 ] || { echo "--map needs a number" >&2; exit 2; }
      map="$2"; shift 2 ;;
    *) echo "usage: queue-list.sh [--map <n>]" >&2; exit 2 ;;
  esac
done

if [ -n "$map" ]; then
  gh api graphql -F o='{owner}' -F r='{repo}' -F n="$map" -f query='
    query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){ issue(number:$n){
      subIssues(first:50){ nodes{ subIssues(first:50){ nodes{ number state title } } } } } } }' \
    --jq '.data.repository.issue.subIssues.nodes[].subIssues.nodes[]
          | select(.state=="OPEN") | "\(.number)\t\(.title)"'
else
  gh api graphql -F o='{owner}' -F r='{repo}' -f query='
    query($o:String!,$r:String!){ repository(owner:$o,name:$r){
      issues(first:100, states:OPEN, orderBy:{field:CREATED_AT,direction:ASC}){
        nodes{ number title parent{ number } } } } }' \
    --jq '.data.repository.issues.nodes[] | select(.parent==null) | "\(.number)\t\(.title)"'
fi
