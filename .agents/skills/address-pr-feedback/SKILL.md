---
name: address-pr-feedback
description: Read a pull request's review comments and threads, fix what they ask for, reply, resolve the addressed threads and re-run CI. Use when a PR has review feedback, unresolved review threads, or a failing "review threads resolved" check.
---

# Address PR Feedback

`CI ok` requires every review thread on the pull request to be resolved (`review threads resolved` job, `scripts/review-threads.sh`).
This skill gets a PR there honestly: fix or answer each thread, never resolve one just to turn CI green.

## 1. Read everything

```bash
scripts/review-threads.sh <pr>          # unresolved threads: path:line, author, thread id, first line
scripts/review-threads.sh <pr> --json   # full bodies (and earlier replies) for each unresolved thread
gh pr view <pr> --comments              # conversation comments and review summaries (not resolvable, still read them)
gh pr view <pr> --json state,headRefName,baseRefName,mergedAt
```

Read every comment in full, including suggested changes and "also applies to" line references.

## 2. Classify each thread

- **Actionable**: a real defect or a clear request. Check it against the code and `review-change` (tenant isolation, two-place
  permissions, PHI, money separation, bounded reads, append-only migrations) before accepting it; reviewers, including bots, can be wrong.
- **Disagree**: the comment is wrong or out of scope. Plan a reply that gives the evidence (code, test, ADR, rule); if out of scope,
  open a follow-up issue with `gh issue create` and link it.
- **Unclear**: you cannot tell what is asked, or it is a product, compliance or security decision. Ask your developer; leave it open.

## 3. Fix

- Open PR: work on its head branch. **Merged PR: never touch `main`**; create `fix/<issue#>-<slug>` from `origin/main` in a worktree for a
  claimed issue (`scripts/work.sh check <n>`), or ask your developer for one.
- Follow `implement-change` and the repository rules: migrations are append-only (a defect in a merged migration is fixed by a new
  migration, `add-migration`), tests for every fix, one Conventional Commit per coherent fix (mention the thread in the body).
- Verify with `verify-change`: `npm run quality`, plus `supabase test db` for database changes. Do not resolve anything before this is green.

## 4. Publish, reply, resolve

Pushing needs explicit approval (or a standing approval in `docs/PROJECT_STATE.md`). After the fixes are pushed:

```bash
# reply in the thread (commit SHA and what changed, or the reason it stays as is)
gh api graphql -f query='mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$t,body:$b}){comment{url}}}' -f t=<thread-id> -f b="Fixed in <sha>: ..."
# resolve it
gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -f t=<thread-id>
```

Resolve addressed (fixed or answered) threads together once the fixes are published; leave unclear ones open. For a merged PR, reply with
the follow-up PR link and resolve. Then confirm `scripts/review-threads.sh <pr> --count` prints `0` (or only the open questions).

## 5. Re-run CI

Resolving a thread does not trigger a workflow. A push re-runs CI by itself; if nothing was pushed (replies only), re-run the failed jobs:

```bash
gh run list --branch <head-branch> --workflow CI --limit 1 --json databaseId --jq '.[0].databaseId'
gh run rerun <run-id> --failed
```

## Report

Per thread: classification, the fix commit or the reply, resolved or still open (and the question asked). Then the CI result.
