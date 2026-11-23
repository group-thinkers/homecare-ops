# ADR-003: Review threads must be resolved before merge

Status: Accepted · Date: 2026-11-22

## Context
Pull requests get review comments from people and from Copilot's automatic review. PR #83 merged with five valid, unresolved P2
threads, because nothing required anyone to read them. `CI ok` is the only required check on `main` (ADR-001), so whatever must hold
before a merge has to be part of it.

## Decision
- A `review-threads` job in `ci.yml` (name "review threads resolved") is part of `CI ok`. On a pull request it runs
  `scripts/review-threads.sh <pr> --check`, which reads `reviewThreads.isResolved` through the GraphQL API and fails while any thread is
  unresolved, listing each one. On push and `workflow_dispatch` it passes (there is no pull request).
- Outdated threads count: changed code does not mean the comment was addressed. Conversation comments and review summaries are not
  resolvable and are not counted.
- The job runs after the other jobs (`needs`), so reviews that arrive while CI runs are counted. It has `pull-requests: read` only.
- The `address-pr-feedback` skill is how agents handle feedback: classify each thread, fix (forward-only for merged migrations), verify,
  publish with approval, reply, resolve the addressed threads together, ask about unclear ones, and re-run CI.

## Alternatives
- **Branch protection "require conversation resolution".** Native and event-driven, but a repository setting outside version control, not
  visible in `CI ok`, and it changes the protection set by ADR-001. Still a reasonable later addition.
- **Trigger CI on `pull_request_review` events.** Would re-run the whole pipeline (Supabase and browser tests) for every review and still
  miss thread resolution, which has no workflow event.
- **Advisory comment or label only.** Does not prevent merging with unread feedback, which is the problem.

## Consequences
- Positive: no PR merges with unread or unanswered review feedback; the failing job lists exactly what is open.
- Negative: resolving a thread does not trigger a workflow, so after resolving without a push someone must re-run the failed jobs
  (`gh run rerun <run-id> --failed`). A review posted after `CI ok` is already green does not turn it red until CI runs again.
- Negative: a reviewer bot can block a merge (including a Dependabot auto-merge) until someone answers and resolves its threads.

## Revisit when
The re-run step becomes a burden or reviews regularly arrive after CI is green: then enable "require conversation resolution" in branch
protection as well (an ADR-001 amendment).
