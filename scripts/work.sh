#!/usr/bin/env bash
# The work board: who is doing what, in a few hundred tokens. Needs `gh` (authenticated) and `jq`.
#   scripts/work.sh board             open issues (assignee, labels) and open PRs (branch, areas touched)
#   scripts/work.sh check <issue>     read-only: is this issue claimed by the current gh user? (agents run this before working an issue)
#   scripts/work.sh claim <issue>     DEVELOPERS ONLY: assign the issue to you, label it in-progress, comment the branch name
#   scripts/work.sh release <issue>   DEVELOPERS ONLY: undo a claim
#   scripts/work.sh overlap           other open PRs that touch files changed on your current branch
# Agents never claim, release or assign: a developer claims an issue and then tells the agent to work on it. claim/release refuse to run
# outside an interactive terminal (an agent's shell is not one). That is a guard against accidents, not a security boundary.
# WORK_DRY_RUN=1 prints write commands instead of running them.
set -euo pipefail
cd "$(dirname "$0")/.."

run() { if [ -n "${WORK_DRY_RUN:-}" ]; then echo "[dry-run] $*" >&2; else "$@"; fi; }
areas() { # file paths on stdin -> "dir1, dir2 (+N)" using the first two path segments
  awk -F/ '{ k=$1; if (NF>2) k=$1"/"$2; c[k]++ } END { for (k in c) print k }' | sort | head -4 | paste -sd, - | sed 's/,/, /g'
}

human_only() {
  if [ ! -t 0 ] && [ -z "${WORK_ALLOW_NON_TTY:-}" ]; then
    echo "work.sh $1 is for developers: agents never claim or release issues. Ask your developer to run: scripts/work.sh $1 $2" >&2
    exit 3
  fi
}

cmd=${1:-board}; shift || true
case "$cmd" in
  check)
    n=${1:?usage: work.sh check <issue>}
    me=$(gh api user --jq .login)
    info=$(gh issue view "$n" --json state,assignees,title)
    [ "$(echo "$info" | jq -r .state)" = OPEN ] || { echo "STOP: issue #$n is not open" >&2; exit 1; }
    holders=$(echo "$info" | jq -r '[.assignees[].login] | join(",")')
    if [ -z "$holders" ]; then echo "STOP: issue #$n is unclaimed. Ask your developer to claim it (scripts/work.sh claim $n), then continue." >&2; exit 1
    elif echo ",$holders," | grep -q ",$me,"; then echo "OK: issue #$n is claimed by @$me"
    else echo "STOP: issue #$n is claimed by @$holders, not @$me. Do not work on it; ask your developer." >&2; exit 1; fi
    ;;
  board)
    echo "== Issues (open)"
    gh issue list --state open --limit 100 --json number,title,assignees,labels |
      jq -r '.[] | "#\(.number)  \(if (.assignees|length)>0 then "@"+(.assignees|map(.login)|join(",@")) else "unclaimed" end)  \(.title[0:70])\(if (.labels|length)>0 then "  ["+(.labels|map(.name)|join(","))+"]" else "" end)"'
    echo; echo "== Pull requests (open)"
    gh pr list --state open --limit 50 --json number,title,headRefName,isDraft,author,files |
      jq -r '.[] | "PR #\(.number)  \(if .isDraft then "draft " else "" end)@\(.author.login)  \(.headRefName)  \(.title[0:60])\n    touches: \([.files[].path] | map(split("/") | if length>2 then .[0:2]|join("/") else .[0] end) | unique | .[0:5] | join(", "))"'
    ;;
  claim)
    n=${1:?usage: work.sh claim <issue>}
    human_only claim "$n"
    info=$(gh issue view "$n" --json state,assignees,title)
    [ "$(echo "$info" | jq -r .state)" = OPEN ] || { echo "issue #$n is not open" >&2; exit 1; }
    me=$(gh api user --jq .login)
    other=$(echo "$info" | jq -r --arg me "$me" '[.assignees[].login | select(. != $me)] | join(",")')
    [ -z "$other" ] || { echo "issue #$n is already claimed by @$other; pick another or ask them" >&2; exit 1; }
    slug=$(echo "$info" | jq -r .title | tr 'A-Z' 'a-z' | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//' | cut -c1-40)
    branch="<type>/$n-$slug"
    run gh label create in-progress --color FBCA04 --description "Someone is working on this" --force >/dev/null
    run gh issue edit "$n" --add-assignee "$me" --add-label in-progress >/dev/null
    run gh issue comment "$n" --body "Claimed by @$me. Branch: \`$branch\`. Plan: \`docs/plans/active/$n-$slug.md\`." >/dev/null
    echo "claimed #$n as @$me; suggested branch: $branch"
    ;;
  release)
    n=${1:?usage: work.sh release <issue>}
    human_only release "$n"
    me=$(gh api user --jq .login)
    run gh issue edit "$n" --remove-assignee "$me" --remove-label in-progress >/dev/null
    run gh issue comment "$n" --body "Released by @$me." >/dev/null
    echo "released #$n"
    ;;
  overlap)
    git fetch -q origin main
    mine=$(git diff --name-only origin/main...HEAD)
    [ -n "$mine" ] || { echo "no changes on this branch yet"; exit 0; }
    cur=$(git branch --show-current); found=0
    while IFS=$'\t' read -r num br files; do
      [ "$br" = "$cur" ] && continue
      hit=$(comm -12 <(echo "$mine" | sort -u) <(echo "$files" | tr ',' '\n' | sort -u) || true)
      if [ -n "$hit" ]; then found=1; echo "PR #$num ($br) also touches:"; echo "$hit" | sed 's/^/    /'; fi
    done < <(gh pr list --state open --json number,headRefName,files | jq -r '.[] | [.number, .headRefName, ([.files[].path]|join(","))] | @tsv')
    [ "$found" = 1 ] || echo "no overlap with other open PRs"
    ;;
  *) sed -n '2,8p' "$0"; exit 2 ;;
esac
