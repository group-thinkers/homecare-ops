#!/usr/bin/env bash
# Unresolved review threads on a pull request (GraphQL reviewThreads.isResolved). Used by CI (the review-threads job, part of `CI ok`)
# and by the address-pr-feedback skill. Needs `gh` (authenticated, or GH_TOKEN) and `jq`.
#   scripts/review-threads.sh <pr> [--list|--count|--check|--json] [--repo owner/name]
#     --list   (default) one line per unresolved thread: path:line, author, outdated flag, thread id, first line of the first comment
#     --count  the number of unresolved threads
#     --check  like --list, but exits 1 when any thread is unresolved (the CI gate)
#     --json   unresolved threads as JSON (id, path, line, isOutdated, comments) for agents
# Outdated threads count: a thread on changed code is not addressed until someone resolves it. Conversation comments and review
# summaries are not resolvable and are not counted.
set -euo pipefail

pr=""; mode=list; repo=${GITHUB_REPOSITORY:-}
while [ $# -gt 0 ]; do
  case "$1" in
    --list|--count|--check|--json) mode=${1#--}; shift ;;
    --repo) repo=$2; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) [ -z "$pr" ] && [[ "$1" =~ ^[0-9]+$ ]] || { echo "usage: review-threads.sh <pr> [--list|--count|--check|--json] [--repo owner/name]" >&2; exit 2; }
       pr=$1; shift ;;
  esac
done
[ -n "$pr" ] || { echo "usage: review-threads.sh <pr> [--list|--count|--check|--json] [--repo owner/name]" >&2; exit 2; }
[ -n "$repo" ] || repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
owner=${repo%/*}; name=${repo#*/}

query='query($owner: String!, $name: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated path line originalLine
          comments(first: 20) { nodes { databaseId author { login } body url } }
        }
      }
    }
  }
}'

threads='[]'; after=""
while :; do
  args=(-f query="$query" -F owner="$owner" -F name="$name" -F pr="$pr")
  [ -n "$after" ] && args+=(-f after="$after")
  page=$(gh api graphql "${args[@]}")
  threads=$(jq -c --argjson acc "$threads" '$acc + .data.repository.pullRequest.reviewThreads.nodes' <<<"$page")
  [ "$(jq -r .data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage <<<"$page")" = true ] || break
  after=$(jq -r .data.repository.pullRequest.reviewThreads.pageInfo.endCursor <<<"$page")
done

unresolved=$(jq -c '[.[] | select(.isResolved | not)]' <<<"$threads")
count=$(jq length <<<"$unresolved")

case "$mode" in
  count) echo "$count"; exit 0 ;;
  json) jq '[.[] | {id, path, line: (.line // .originalLine), isOutdated, comments: [.comments.nodes[] | {databaseId, author: .author.login, body, url}]}]' <<<"$unresolved"; exit 0 ;;
esac

total=$(jq length <<<"$threads")
echo "PR #$pr: $count unresolved of $total review threads"
jq -r '.[] | "- \(.path):\(.line // .originalLine // "?")  @\(.comments.nodes[0].author.login // "ghost")\(if .isOutdated then "  (outdated)" else "" end)  \(.id)\n    \((.comments.nodes[0].body // "") | split("\n") | map(select(test("\\S"))) | .[0] // "" | .[0:140])"' <<<"$unresolved"

if [ "$mode" = check ] && [ "$count" -gt 0 ]; then
  echo "Resolve every review thread (fix it, or reply with the reason and resolve). Resolving does not re-run CI: re-run this job afterwards." >&2
  exit 1
fi
