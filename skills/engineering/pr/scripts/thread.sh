#!/bin/sh
# Answer one review thread.
#   thread.sh reply   <threadId> <body>   post a reply on the thread
#   thread.sh resolve <threadId>          mark it resolved
set -eu
case "${1:-}" in
  reply)
    gh api graphql -f query='mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(
      input:{pullRequestReviewThreadId:$t, body:$b}){comment{url}}}' \
      -F t="${2:?threadId}" -F b="${3:?body}" --jq '.data.addPullRequestReviewThreadReply.comment.url' ;;
  resolve)
    gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' \
      -F t="${2:?threadId}" --jq '.data.resolveReviewThread.thread.isResolved' ;;
  *) echo "usage: thread.sh reply <threadId> <body> | thread.sh resolve <threadId>" >&2; exit 2 ;;
esac
