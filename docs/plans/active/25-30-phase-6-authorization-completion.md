# Phase 6 Authorization Completion

- **Issue:** #25–#30 (claimed by @apello; ownership confirmed with `scripts/work.sh check`)
- **Owner:** @apello
- **Branch:** `feat/authorization-service-schemas`
- **Status:** Implementation complete; blocked on required environment verification
- **Areas touched:** `src/app/(dashboard)/patients`, `src/app/(dashboard)/settings`, `src/app/(dashboard)/caregivers`, `src/lib`, `src/types`, `supabase/tests/database`, `tests/unit`, `docs`
- **Migration number claimed:** `00018_authorization_read_boundaries.sql` (safe column grants, bounded authorization read models, scheduler reads and permissioned rates).
- **Spec / plan refs:** `docs/implementation-plan.md` §6; `docs/plans/phase-6-issue-drafts.md`; `docs/IMPLEMENTATION_CHEATSHEET.md`; `docs/DATABASE.md` §4.4

## Outcome

Complete the Phase 6 authorization module: payers, organization services, patient authorizations and service lines, effective reimbursement rates, scheduler-safe compatibility, UI and tests. The authorization foundation in commit `eb0fb6ef8740fb3040e09f35cb14f957518ab29e` is the starting point, not assumed complete without verification.

## Non-Goals

- No Phase 7 shift workflows, Phase 8 matching workflows, or Phase 9 call-off workflows; expose the compatibility contract they will consume.
- No historical rate backdating, persisted expiry job, or encryption migration. Prior-authorization values remain synthetic-only and only the masked value may be projected or displayed.
- No real PHI, caregiver compensation redesign beyond replacing the raw organization-service ID input, and no unrelated product or UI cleanup.

## Current State (verified against the repo, not the plan's checkboxes)

- The feature branch starts at the owner-supplied commit and contains the existing Phase 6 schemas, types, services and migration 00016/00017 contracts.
- The branch now has the 00018 read-boundary migration and authorization pgTAP suite; database execution is blocked by the missing local Docker/Podman runtime (KI-006).
- Payer settings/actions, organization-service/rate UI, patient-authorization UI, server actions, and the caregiver compensation picker are implemented and covered by unit tests.
- `scripts/work.sh check 25` through `check 30` report each issue claimed by @apello.
- `npm run quality` passes after retrying Next.js's security reminder; the installed version still has a known security vulnerability. The upgrade is outside this plan and awaits owner choice.

## Known issues considered

- KI-004: `authorizations.read_rates` and the unused `reports.read` permission decision.
- KI-006: missing RLS/RPC tests for authorization rates and scheduler-safe compatibility.
- KI-011: addressed by the cited commit on this branch; mainline does not yet include it.
- KI-016: compensation form accepts a raw organization-service ID.
- KI-017: missing optimization-plan document; apply the requirements in Phase 6 and Key Rules 11–15 unless the owner supplies a replacement.
- KI-013/014: no real PHI; encryption and HIPAA production readiness remain out of scope.

## Decisions (confirm questionable ones before implementing)

- Use the Phase 6 optimization requirements plus Key Rules 11–15 as the operative guidance in place of the absent `API_AUTHORIZATION_OPTIMIZATION_PLAN.md`, consistent with KI-017 and the owner's direction to proceed.
- Remove the unused `reports.read` permission from `PermissionCode`, as directed by the owner on 2026-11-22. No database role grants or behavior use it.
- Keep all rate values out of general lists, logs and operational events. Read/display raw reimbursement amounts only behind `authorizations.manage` or `authorizations.read_rates`; scheduler compatibility remains non-financial.
- Migration 00018 is required to prevent authenticated direct table reads from bypassing the intended authorization-number and reimbursement-rate boundaries. Keep it append-only and cover each new RPC/grant boundary with pgTAP.

## Proposed Design

Verify the existing foundational types, schemas, services and RPC contracts against issue acceptance criteria. Add server actions using the repository's auth → strict validation → permission → service → revalidation ordering, with organization scope derived from the active membership in pages. Implement list and detail pages with explicit projections, bounded pagination and batched rate resolution. Complete service-line mutations and rate history UI using the existing transactional RPCs. Add a multi-permission helper for documented read boundaries. Keep the financial and masked-data boundaries enforced in services, RLS/RPCs, actions and UI.

Build in dependency order: foundations/tests, payers and organization services, patient authorizations, then service lines and rate UI. The independent payer and organization-service slices may be developed concurrently only after foundations are verified; shared navigation and caregiver picker integration are coordinated as a single owner-controlled change.

## Affected Files

- `src/types/index.ts`, `src/lib/permissions/index.ts`, `src/lib/schemas/authorizations.schema.ts`, `src/lib/services/authorizations.service.ts`
- `src/app/(dashboard)/patients/actions.ts`, `src/app/(dashboard)/patients/[patientId]/authorization/**`, `src/app/(dashboard)/patients/_components/PatientCore.tsx`
- New payer and organization-service routes/actions/components under `src/app/(dashboard)/settings/payers/**` and `src/app/(dashboard)/settings/services/**`
- `src/app/(dashboard)/caregivers/_components/CompensationForm.tsx` and relevant caregiver route data loading
- `src/app/(dashboard)/DashboardFrame.tsx`
- `tests/unit/permissions.test.ts` and related schema, service, action and component tests
- `supabase/tests/database/` authorization policy/RPC tests; `docs/DATABASE.md` only if verified policy or permission documentation is missing
- `docs/KNOWN_ISSUES.md` and `docs/plans/active/` as warranted by completed criteria and progress

## Acceptance Criteria

- `npm run quality` exits 0 after implementation; warnings are reported without unrelated cleanup.
- `supabase test db` has 74 pgTAP assertions for organization-service-rate RLS, financial-reader access, scheduler compatibility without raw rates, paginated reads, status transitions, cross-organization denial and `anon` denial. **UNVERIFIED (env):** `supabase start` and `supabase test db` cannot connect because neither Docker nor Podman is installed; rerun both commands in a Docker-enabled environment.
- `npm run test:e2e` is **UNVERIFIED (env):** its Supabase startup fails without Docker/Podman, followed by `API_URL: unbound variable`. Authenticated browser flows therefore remain unverified.
- `git diff --check` exits 0.
- Payer and organization-service lists use bounded pagination, explicit projections, deterministic ordering and database-side counts; the caregiver compensation form selects an active organization service instead of accepting a raw ID.
- Authorization lists/details never select or expose `encrypted_prior_auth_number`; read-time expiry does not write; detail rate resolution is batched, not per service row.
- Authorization status transitions are validated; service lines can be safely upserted/deactivated; compatibility results contain no amount or rate unit.
- Ordinary rate changes use the existing RPC prospectively, close prior effective ranges atomically, and never place amounts in operational events.

## Verification Plan

- Focused Vitest tests for permission helpers, schemas, service pure logic and action matrices.
- `npm run quality` for lint, typecheck, unit suite and production build.
- `supabase start` then `supabase test db` for RLS/RPC policy changes or their coverage.
- `npm run test:e2e` and browser-based role checks for the new routes and forms.
- Inspect generated projections and test doubles to verify no hidden financial/encrypted fields leak and no N+1 calls are introduced.

## Risks

- Raw rate exposure and cross-tenant authorization/service joins could disclose financial or patient data; enforce RLS and action permissions independently and test scheduler/cross-org/anon cases.
- Prior-authorization values are not encrypted by the current schema; use only synthetic data and never log or include unmasked values in any list/detail projection.
- Shared types and Settings navigation are hot files; keep changes append-only and preserve concurrent work.
- The repo's current Next.js build emits a known-vulnerability warning. Do not silently upgrade dependencies within this feature; get the owner's choice for the separate security update.

## Ordered Steps

- [x] 1. Remove and document the `reports.read` decision; verify the existing foundation and RPC contracts and record the Phase 6 optimization-guidance disposition.
- [x] 2. Add migration 00018 to remove direct read privileges on sensitive columns, add safe scheduling reads and authorized batched effective-rate resolution; document and pgTAP-test it.
- [x] 3. Complete foundations and permission/RLS tests for #25, including tests for raw-rate and scheduler-safe compatibility boundaries.
- [x] 4. Implement and test payer actions, settings pages and navigation for #26.
- [x] 5. Implement and test organization-service actions/pages, compensation service picker and navigation for #27.
- [x] 6. Implement and test patient-authorization actions, list/detail/create/edit/archive pages, masked prior-auth display and PatientCore link for #28.
- [x] 7. Implement and test authorization service-line actions/pages, `requireAnyPermission`, and compatibility/list-active service contracts for #29.
- [x] 8. Implement and test prospective rate history UI and effective-rate behavior for #30; verify operational events contain no amount.
- [ ] 9. Run database and browser suites, quality gate, inspect the complete diff, and append evidence to this plan.

## Progress log

- 2026-11-22: Confirmed issues #25–#30 are claimed by @apello. Verified the cited commit is the current branch head; found schemas/types/services and tests present, but UI/actions and authorization-specific database tests are missing. Restored dependencies with `npm ci`; baseline `npm run quality` passed after retrying Next's security reminder, with the warning noted above. Next: resolve the two owner decisions, verify the existing foundation against acceptance criteria, then implement the vertical slices.
- 2026-11-22: Recorded the owner's `reports.read` removal decision and added migration 00018 with safe column grants, bounded SQL authorization list/detail read models, scheduler-safe service reads, and permissioned effective-rate output. Added 62 pgTAP assertions; **UNVERIFIED (env)** because `supabase start` failed (`docker: command not found`, Podman unavailable). Focused authorization/schema/action/permission tests pass (39 tests); the caregiver service picker test passes (1 test). Payer-agent verification passed its focused suite (2 files, 14 tests), typecheck, and lint. The full typecheck currently hits missing component imports in the in-progress organization-service UI slice; rerun after agent completion.
- 2026-11-22: Completed payer, organization-service/rate, patient-authorization, service-line and caregiver-picker slices. Added bounded pagination for authorization detail and scheduling reads, explicit read failures, and a database trigger for status transitions. **VERIFIED:** `npm run quality` (475 tests; pass on retry after Next.js advisory), focused suites (77 tests), TypeScript, lint, browser DOM check for `/login`, and `git diff --check`. **UNVERIFIED (env):** `supabase start` / `supabase test db` (Docker/Podman unavailable) and `npm run test:e2e` (same startup blocker; `API_URL` remains unset). Authenticated feature flows and database role/RLS behavior require a Docker-enabled environment. Review found no remaining P0/P1 findings after fixes. Task closeout remains blocked on the required database and E2E verification.
- 2026-11-22: Owner authorized committing and pushing the feature branch and applying the migration with the Supabase CLI. The linked Daedalus project has migrations through 00017; `supabase db push --linked --dry-run` lists only 00018. `scripts/check-migrations.sh --base origin/main` passes. Plan to run branch CI, including its fresh Supabase database tests, before applying 00018; local database and browser verification remain blocked by missing Docker/Podman. Current `origin/main` already includes Next.js 16.4.6.
- 2026-11-22: Dispatched branch CI (run 45084006027). Lint, typecheck, unit tests, build and migration-order passed; database and browser jobs failed while applying 00018 because `authorization` was used as a SQL alias. Renamed it to `patient_authorization` and will rerun CI before any production push. Local dependency installation is incomplete after two attempts ran out of disk space; the feature branch is pushed and no production migration has been applied.
- 2026-11-22: CI run 45084294834 successfully applied 00018 from scratch and passed the browser, lint, typecheck, unit, build and migration-order jobs. The pgTAP suite stopped before its assertions on a malformed synthetic organization UUID in one fixture; corrected that fixture. Database security assertions remain unverified until rerun.
