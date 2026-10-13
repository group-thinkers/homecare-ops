<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Engineering Guide

Entry point for AI agents working in this repository. Keep it concise: detail lives in `/docs`. This project is built
mostly by agents, so a session must be able to continue from the repository alone, with no chat history.

## Mission

Build **Daedalus** (package `homecare-ops`): the Healthcare Operations Command Center for home-care agencies. It handles
patients, caregivers, payer authorizations and approved service rates, shifts, caregiver matching, call-off replacement,
notifications and an operations dashboard, for several agencies (organizations) in one database. The MVP promise to
validate: **faster call-off replacement, better caregiver-patient fit, less manager time.**

> An agency must be able to trust that it only ever sees its own data, and that staff only see what their role allows.
> Everything else depends on that trust.

**Data policy.** The MVP uses synthetic or de-identified data only. Real PHI must not enter any environment until the
HIPAA production-readiness work is done (MFA, audit logging, BAAs, backup and recovery, and so on). Never copy production
data into dev, test or preview, and never put realistic patient-like data in fixtures, logs, URLs or commits.

## Session Start Protocol

Every session, in order, before editing anything:

1. Read `docs/PROJECT_STATE.md`: where we are, the exact next task, and what is blocked.
2. Read the active plan in `docs/plans/active/` (at most one) and continue from its first unchecked step.
3. Read the phase you are in from `docs/implementation-plan.md`, and `docs/IMPLEMENTATION_CHEATSHEET.md` (how each layer is written).
4. Read `ARCHITECTURE.md`, the open S1/S2 rows in `docs/KNOWN_ISSUES.md`, and skim the newest ADRs in `docs/decisions/`.
5. Run `git status`, `git log -5`, then `npm run quality`. It must be green before you start; if it is not, fixing it is the first task.
6. Do not re-plan finished work.

Before ending a session, update `docs/PROJECT_STATE.md` so another agent can continue without chat history.

## Source of Truth and Precedence

1. This file
2. Accepted ADRs in `docs/decisions/` (they amend the documents below)
3. The product spec: *Healthcare Operations Command Center — Product Requirements & System Design* (v1 draft, owned by the
   product and engineering leads; not in this repo, ask the owner for the current copy)
4. `docs/implementation-plan.md` (phases, per-phase deliverables, Key Rules)
5. `docs/IMPLEMENTATION_CHEATSHEET.md` (the prescriptive pattern for every layer: copy it exactly)
6. `docs/DATABASE.md` (the schema, RLS and RPC reference), `docs/MIGRATIONS.md`, `docs/QUERY_PERFORMANCE_BACKLOG.md`
7. Existing code, tests and database policies
8. Engineering judgment

Never silently diverge from the spec or plan. If a better tradeoff appears, write an ADR first (skill `write-adr`), then
change the code. The plan and cheatsheet were written on 2026-09-09 and parts are stale; where they disagree with the
code, `docs/PROJECT_STATE.md` says which is right.

## Workflow: one task, one plan, one branch

Use the skills in `.agents/skills/` (also visible to Claude Code as `.claude/skills`):

```text
plan-change -> implement-change -> verify-change -> review-change
            -> harden-change    -> complete-task  -> prepare-pr
```

- Work proceeds one entity vertical slice at a time, in the cheatsheet's build order:
  **migration → types → schemas → service → actions → pages → components → nav → tests → verify.**
  Finish a whole slice before starting the next.
- Non-trivial work starts with a plan in `docs/plans/active/<slug>.md`; finished plans move to `docs/plans/completed/`.
- Work on `<type>/<slug>` branches (`feat/`, `fix/`, `chore/`, `ci/`, `docs/`, `test/`). Never work on `main`.
  One commit per coherent unit, Conventional Commits (`feat(caregivers): …`).
- A task is complete when each acceptance criterion is evidenced with a command and its output.
- Database changes always follow the `add-migration` skill.

## Key Rules (from the plan, carried across every phase)

1. Business logic belongs in services, not in pages or server actions.
2. Organization context comes from the authenticated membership, never from browser input.
3. Every server action: **authenticate → validate (Zod, `.strict()`) → permission → service → revalidate.**
4. Sensitive fields are hidden at the service layer, not only in the UI.
5. Assignment and replacement confirmation are transactions: one RPC, all or nothing, revalidated inside it.
6. Matching results are recommendations only; final assignment always re-runs validation.
7. Operational history stores non-sensitive metadata only: no patient names, addresses, authorization numbers or pay/rate values.
8. Notifications use controlled templates; no free-text patient-like content in outreach.
9. The travel cache uses location hashes, never raw addresses.
10. All test data is synthetic.
11. Authorization is request-local: deduplicate within one render, never cache permissions across requests.
12. Lists are bounded and projected: database-side pagination, filters and counts; no `select('*')` in list/read models.
13. No per-row API calls: batch or join the data a page needs.
14. Reads do not perform maintenance writes; derive time-based state at read time.
15. Ordinary workflows run under the user's session and RLS. The service-role client is for `auth.admin.*` only.

## Architectural Invariants (never violate without an ADR)

- **INV-1 Tenant isolation.** Every tenant row carries `organization_id`; child tables use composite foreign keys so a
  child cannot cross organizations. RLS must be correct on its own; application filters are an extra, not a substitute.
- **INV-2 Permissions in two places.** Server actions call `requirePermission(...)`; the database enforces the same
  permission in policies or `security definer` RPCs via `has_org_permission(...)`. A new permission needs both and a test.
- **INV-3 Every new table enables RLS** in the migration that creates it (`supabase test db` fails otherwise).
- **INV-4 Migrations are append-only.** Never edit one that is on `main`; fix forward with a new file. (Production
  applies new migrations on merge.) The one past exception is recorded in `docs/KNOWN_ISSUES.md` (KI-010).
- **INV-5 Money stays separate.** Caregiver pay rate, payer reimbursement rate and approved service rate are three
  different concepts; each has its own permission and none appears in a list view, a log or an operational event.
- **INV-6 Validate at the boundary** with Zod in `src/lib/schemas/` (existing exceptions: KI-005).
- **INV-7 Layering.** `page / component -> server action -> service -> Supabase (RPC or table, under RLS)`. Components
  never touch Supabase; actions never call Supabase directly. (Auth flows use Supabase Auth directly.)
- **INV-8 Soft delete.** Patient, caregiver and authorization records are archived or deactivated, never hard-deleted
  (a pending invitation may be deleted). Append-only tables are written only inside RPCs.

## Engineering Principles

- Smallest coherent solution; no refactors of unrelated code. Mirror `src/app/(dashboard)/patients/**` and `src/lib/{schemas,services}/patients.*`.
- No new dependency without a stated reason.
- Server actions return `ActionResponse<T>`; authorization failures return `'Not authorized.'` and never reveal whether a record exists.
- Comments explain why, not what. Never log patient data, secrets or pay/rate values: ids and filters only.
- Never remove, weaken, skip or rewrite a failing test to get green.

## Verification

Evidence vocabulary, used in plans, reports and `PROJECT_STATE.md`:

- **VERIFIED**: a command was run in this environment and its output observed.
- **UNVERIFIED (env)**: cannot be run here (for example Docker is not running). Say why and what would verify it. Never write PASS for these.
- **ASSUMED**: reasoned, not exercised.

The gate is `npm run quality` (lint, typecheck, unit tests, build). Also:
- `supabase start`, then `supabase test db` for any change to migrations, policies, grants or RPCs.
- `npm run test:e2e` for any change to auth, navigation or a user-facing flow.
- UI changes must be exercised in a browser (screenshot or DOM check), not only built.
- Performance-sensitive modules also need the request-budget tests described in the plan (Phase 14).

CI runs everything on every pull request; `CI ok` is the required check.

## Debugging

Reproduce, gather evidence, find the root cause, make the smallest correct fix, prove the failure is gone, check for
regressions. Do not patch symptoms. **If you cannot make progress in two attempts, stop and ask** (the plan's working agreement).

## Git and Release Safety

- Never force push. Never push or merge to `main`. Never discard uncommitted user work.
- Committing on a feature branch is allowed. **Pushing, opening or merging a PR, and any change to repository, Vercel or
  Supabase settings needs explicit approval** (a standing approval written by the owner in `docs/PROJECT_STATE.md` counts).
- Merging to `main` deploys: Vercel ships the app and a workflow applies new `supabase/migrations/` to production.
  Treat every merge as a release. This repository is **public**: nothing sensitive may be committed.
- Never commit secrets, `.env*`, seed files with passwords (`supabase/seed/` is git-ignored), or real data.

## Security

Never expose, print, modify or commit API keys, passwords, tokens or `.env` contents. Changes to auth, sessions,
permissions, RLS, grants or RPCs are security-sensitive: run `review-change` with the security checks and note the result
in the plan. Secret scanning and push protection are on; a blocked push is a signal, not an obstacle.

## When to Ask

Stop and ask only for: missing credentials or accounts, destructive or irreversible actions, legal or compliance choices
(for example PHI retention or which provider handles notifications), product decisions the spec leaves open or that change
scope, installing system software, and anything that publishes, pushes or changes settings. For everything else, choose
the simplest production-quality option, record it in the plan or an ADR, and continue.

If an environment tool is missing (Docker, Supabase CLI, a browser), do not fake it: mark affected criteria
`UNVERIFIED (env)` in `docs/KNOWN_ISSUES.md` and continue with what is verifiable.

## Repository Knowledge

- State and next task: `docs/PROJECT_STATE.md` · Architecture: `ARCHITECTURE.md`
- Plan and conventions: `docs/implementation-plan.md`, `docs/IMPLEMENTATION_CHEATSHEET.md`, `docs/QUERY_PERFORMANCE_BACKLOG.md`
- Database: `docs/DATABASE.md`, `docs/MIGRATIONS.md`, `supabase/migrations/`
- Known issues and open product questions: `docs/KNOWN_ISSUES.md` · Decisions: `docs/decisions/`
- Active / completed plans: `docs/plans/active/`, `docs/plans/completed/` · Open work items: GitHub Issues
- Tests: `tests/unit/` (vitest) · `supabase/tests/database/` (pgTAP) · `tests/e2e/` (Playwright)
