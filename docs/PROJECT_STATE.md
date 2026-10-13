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
| 6 Authorizations | **Database only.** Migrations 00016 and 00017 are in `main` (RPCs, rate history, scheduler-safe compatibility check). The plan ticks the service, schema and type items as done, but `main` has no `authorizations.service.ts`, no schema, no actions, no pages, no `Database.Functions` entries (KI-011). |
| 7–12 | Not started. `/dashboard` is a placeholder that prints session JSON. |
| 13–15 | Conventions apply per phase; testing and deployment tooling are in place; budgets and monitoring are not. |

Tests: ~370 unit, 36 pgTAP assertions, 11 browser tests. All CI checks pass.

## Blocked on the owner (agents cannot do these)
1. **Production migration push** fails with `Invalid access token` (KI-001). The production database may still be current if
   migrations were applied by hand with the CLI (`docs/DATABASE.md` says "applied through 00017"). The owner should replace
   `SUPABASE_ACCESS_TOKEN` and run `supabase migration list` to compare local and remote.
2. **Vercel "wait for checks"** is not configured (KI-002).
3. **Missing and unconfirmed inputs**: `API_AUTHORIZATION_OPTIMIZATION_PLAN.md` (referenced as mandatory, not in the repo, KI-017); whether
   unmerged Phase 6 code exists (KI-011); the product questions in KI-015.

## Standing approvals
None. Pushing and opening PRs need explicit approval each time (AGENTS.md, Git and Release Safety). The owner may record a
standing approval here, for example: "agents may push branches and open PRs; the owner merges."

## Housekeeping
- PR #11 is an empty Copilot attempt ("no changes to propose"); close it.
- Open GitHub Issues: #1 (user list query standardization), #2 (auth token refresh), #3 (address autocomplete), #5 (document scanner), #9 (notification templates), #10 (matching ruleset in the database).
- The plan's migration numbers are stale (KI-012); the next free number is 00018.

## Proposed next task (the owner confirms)
Phase 6: the authorization module, as vertical slices (payers and organization services first, then patient authorizations with
service lines, then rate management), following plan §6 and the optimization checklist in §6.0. **First** confirm with the owner
whether the other developer has unmerged Phase 6 code (KI-011), and get `API_AUTHORIZATION_OPTIMIZATION_PLAN.md` (KI-017). Start with `plan-change`.
After that, the plan's order is: Phase 7 shifts, Phase 3 leftovers, Phase 8 matching, Phase 9 call-offs, then 10–12.

## Verification commands
`npm run quality` · `supabase start` then `supabase test db` · `npm run test:e2e`
