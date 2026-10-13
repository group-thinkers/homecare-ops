# ADR-002: Multi-contributor coordination

Status: Accepted · Date: 2026-10-13

## Context
Several developers, each with their own agents, will work in this repository at the same time. Agents cannot see each other's
conversations. The first version of the agent workflow assumed one task at a time (one active plan, a shared handoff file updated every
session), which would cause constant conflicts, and nothing stopped two PRs taking the same migration number, which would break the
production migration push.

## Decision
- **GitHub is the shared memory.** Issues are the work board; an assignee is the developer who owns the work; draft PRs show what is in flight.
- **Developers claim issues; agents never do.** A developer runs `scripts/work.sh claim <n>` and then tells the agent which issue to work on.
  The agent runs `scripts/work.sh check <n>` and stops if the issue is unclaimed or held by someone else. `claim` and `release` refuse to run
  in a non-interactive shell. This is a guard against accidents: an agent shares its developer's GitHub login, so it is not a security boundary.
- **One plan per task** (`docs/plans/active/<issue#>-<slug>.md`, from `docs/plans/TEMPLATE.md`), with a Progress log for handoff. `PROJECT_STATE.md`
  is edited only when a task completes, as a minimal diff; it no longer names a "next task".
- **Migration order is enforced in CI** (`scripts/check-migrations.sh`, job `migration-order`, part of `CI ok`): unique, gapless numbers, and no edits,
  deletes or renames of migrations already on `main`, unless listed with a reason in `supabase/migration-edits.allow`.
- **Branch protection keeps "require branches to be up to date" off.** Turning it on would make every merge force the others to update their
  branch, and would stall Dependabot's patch auto-merge, because an update made by a workflow does not trigger CI. Instead a red `main` alerts
  Discord, and the migration check runs on the merge result.
- **CODEOWNERS** requests a review from `abdullahimohamed101` for migrations, RLS tests, CI, scripts and the agent rules. It does not block merging.
- **Work in git worktrees**, one per task; rebase on `main` before a PR; squash merges.

## Alternatives
- Agents claim their own work: rejected by the owner; developers decide who works on what.
- A project-management tool outside GitHub: one more place to keep in sync.
- Require up-to-date branches or a merge queue now: more friction than three contributors justify; revisit below.
- Timestamp-named migrations to avoid number collisions: the existing sequential convention and the plan depend on numbers.

## Consequences
- Coordination costs about 150 tokens per session (`work.sh board`).
- Two agents on one developer's account look like one person, so the claim comment records the branch.
- The protocol is advisory except for the migration check, the CODEOWNERS review request and the `claim` guard.

## Revisit when
There are more than a handful of active contributors, or two PRs have conflicted despite the checks (consider GitHub's merge queue, or "require
up to date"); or an agent ever claims an issue (tighten the guard).
