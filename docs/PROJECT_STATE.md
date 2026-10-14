# Project State

Last updated: 2026-10-13. Keep this file short and current; history belongs in git and `docs/plans/completed/`.

## Where we are

The foundation, user management, patients and caregivers are built and demoable. Authorizations exist only as database
migrations. Scheduling, matching, call-offs, notifications, the dashboard and operational history are not started.
CI/CD, security scanning and this agent workflow are in place (ADR-001). The MVP uses synthetic data only (see AGENTS.md).

The plan (`docs/implementation-plan.md`) is dated 2026-09-09 and its "Current State" table is stale. Reality, checked against `main`:

| Plan phase | Reality in `main` |
|---|---|
| 1 Foundation, 2 Users | Done. |
| 3 Reference data | Billing services and EVV mappings are in migration 00012. **Not done:** `matching_rulesets` rows (issue #10) and `notification_templates` rows (issue #9). |
| 4 Patients | Done (list, create, edit, archive, addresses, contacts, requirements, approval page). The authorization section is a placeholder page. |
| 5 Caregivers | Done (list, create, edit, credentials, skills, availability, compensation, approval page). Eligibility and compensation forms take a raw `organization_service_id` until Phase 6 (KI-016). Caregiver action tests are missing (plan 5.7). |
| 6 Authorizations | **Database only.** Migrations 00016 and 00017 are in `main` and applied to production on 2026-10-14 (RPCs, rate history, scheduler-safe compatibility check). The plan ticks the service, schema and type items as done, but `main` has no `authorizations.service.ts`, no schema, no actions, no pages, no `Database.Functions` entries (KI-011). |
| 7–12 | Not started. `/dashboard` is a placeholder that prints session JSON. |
| 13–15 | Conventions apply per phase; testing and deployment tooling are in place; budgets and monitoring are not. |

Tests: ~370 unit, 36 pgTAP assertions, 11 browser tests. All CI checks pass.

## Blocked on the owner (agents cannot do these)
1. **Vercel "wait for checks"** is not configured (KI-002).
2. **Missing and unconfirmed inputs**: `API_AUTHORIZATION_OPTIMIZATION_PLAN.md` (referenced as mandatory, not in the repo, KI-017); whether
   unmerged Phase 6 code exists (KI-011); the product questions in KI-015.

## Standing approvals
None for pushing or opening PRs: each needs explicit approval (AGENTS.md, Git and Release Safety). The owner may record one here, for
example: "agents may push branches and open draft PRs; developers merge." Claiming issues is never delegated: developers claim, agents do not.

## Housekeeping
- PR #11 (an empty Copilot attempt) was closed on 2026-10-13.
- The plan's migration numbers are stale (KI-012); the next free number is 00018.

## Work board
There is no "next task" here: GitHub Issues are the board and developers claim them (`scripts/work.sh board`). The plan's order for the
remaining phases is 6 authorizations, 7 shifts, 3 leftovers, 8 matching, 9 call-offs, then 10-12. Before anyone plans Phase 6, resolve
KI-011 (is there unmerged Phase 6 code?) and KI-017 (the missing optimization plan). The Phase 6 issues exist (#24 gate, #25 to #30); the breakdown and order are in
`docs/plans/phase-6-issue-drafts.md`. They are labelled `blocked` until the gate (#24) is resolved.

## Verification commands
`npm run quality` · `supabase start` then `supabase test db` · `npm run test:e2e`
