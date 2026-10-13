# Phase 6 (Authorizations): draft issues

Draft only: no GitHub issues exist for these yet. Source: `docs/implementation-plan.md` §6 (`scripts/doc.sh plan "^## Phase 6"`),
checked against `main` on 2026-10-13. Main has migrations 00016 and 00017 and a placeholder page; none of the service, schema, action,
page or type work exists (KI-011). Each slice below is one vertical slice, in the cheatsheet's order, and one issue.

| # | Issue (draft title) | Depends on | Migration | Notes |
|---|---|---|---|---|
| 0 | **Phase 6 discovery**: confirm whether unmerged Phase 6 code exists; obtain `API_AUTHORIZATION_OPTIMIZATION_PLAN.md` | none | no | Gate. Closes KI-011 and KI-017. A human decision, not agent work. |
| A | **Authorization foundations**: add `authorizations.read_rates` to `PermissionCode`; register the 00016/00017 RPCs in `Database.Functions`; row, joined and constant types (`PAYER_TYPES`, `AUTHORIZATION_STATUSES`, `EffectiveRate`, ...); forward-fix migration 00018 for `check_authorization_service_compatibility`; pgTAP tests for `organization_service_rates` and the authorization RPCs, including "a Scheduler gets compatibility but never a raw rate" | 0 | yes (00018) | Closes KI-004, KI-006, KI-010. Do first: B-F build on it. |
| B | **Payers**: schema, service, actions, `/settings/payers` list/new/edit, nav entry, tests | A | no | Plan 6.3 to 6.6. Read: any member; write: `authorizations.manage`. |
| C | **Organization services**: activate a service from the mappings, list, edit; `/settings/services`; plus an organization-service picker for the caregiver eligibility and compensation forms | A | no | Closes KI-016. Unique `(organization_id, service_code_mapping_id)` gives a friendly error. |
| D | **Patient authorizations**: list, create (via `create_authorization_with_services`), detail read model (bounded service rows, batch-resolved effective rates), edit with allowed status transitions, archive; pages under `/patients/[id]/authorization`; masked prior-auth number only | A, B, C | no | Replaces the placeholder page. Encrypted number never in any projection. Expiry derived at read time. |
| E | **Authorization service lines and the compatibility check**: upsert/deactivate service lines; the scheduler-safe `checkAuthorizationServiceCompatibility` service and action; `listActiveAuthorizationServicesForPatient` | D | no | The contract Phase 7 shifts and Phase 8 matching must call. |
| F | **Organization service rates**: rate history view, set a prospective rate (`set_organization_service_rate`), effective-rate resolution (authorization first, then organization rate, then missing); no backdate control | A, C | no | Plan 6.0.2. Needs `authorizations.manage` or `read_rates`. Operational event without the amount. |

Suggested order: 0, A, then B and C in parallel, then D, then E and F in parallel. Every slice includes unit tests (actions, service, schema), a
pgTAP test for anything new in the database, and the request-budget checks from the plan's §6.0.
