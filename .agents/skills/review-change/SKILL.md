---
name: review-change
description: Independent skeptical senior review of a diff for correctness, tenant isolation, permissions, PHI and money separation, and maintainability. Read-only.
---

# Review Change

Act as a skeptical senior reviewer. Do not modify files. Review against the plan, acceptance criteria, `AGENTS.md` invariants
and Key Rules, the spec and ADRs.

Check for: correctness bugs, regressions, missing edge cases, error handling, concurrency, compatibility breaks, data
integrity, boundary violations, unnecessary complexity and duplicated logic.

Product-specific checks:
- **Tenancy**: every query is scoped by `organization_id`; child tables use composite FKs; a test proves a cross-organization read fails.
- **Permissions in two places**: action `requirePermission` AND database policy/RPC check; the permission code exists in the DB defaults and the TypeScript type.
- **Roles**: confirm what a Scheduler, Clinical Manager, HR Coordinator and suspended member can and cannot reach.
- **Money**: caregiver pay rate, reimbursement rate and approved service rate stay separate; none in a list view, log, notification or operational event; Schedulers get compatibility flags, never amounts.
- **PHI**: nothing sensitive in URLs, logs, error messages, analytics or fixtures; clinical/restricted data behind its permission; identifiers masked where full values are unnecessary.
- **Transactions & idempotency**: assignment/replacement/call-off changes are one RPC, revalidated inside; retries create no duplicates; optimistic `version` checks where the plan requires them.
- **Reads**: bounded, projected, paginated in the database; no per-row calls; no maintenance writes during reads.
- **Migrations**: append-only, explicit `revoke`/`grant`, RLS enabled on new tables, `docs/DATABASE.md` updated.
- **Service role**: not used in ordinary user workflows.
- **Spec drift**: anything that silently diverges from the spec, plan or an ADR.

Classify findings P0 critical, P1 must fix before merge, P2 should fix, P3 optional. For each: severity, exact location, problem,
impact, suggested correction. Anything not fixed goes into `docs/KNOWN_ISSUES.md` with a severity and a target. If there are
no substantive issues, say so explicitly.
