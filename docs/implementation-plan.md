# MVP Implementation Plan
## Home Healthcare Operations Platform

**Stack (actual):** Next.js 16 · TypeScript · MUI Material 9 + X DataGrid · controlled forms (no RHF) · Zod 4 · Supabase (Auth + PostgreSQL) · Amazon Location Service  
**Hosting:** Vercel · Supabase Cloud · GitHub  
**Data policy:** Synthetic / de-identified test data only until HIPAA production-readiness is complete.

---

## Current State (as of 2026-09-09) — read this first

**Companion docs (same folder):** `IMPLEMENTATION_CHEATSHEET.md` (how every layer is written), `DATABASE.md` (schema/RLS/RPC source of truth), `MIGRATIONS.md` (push-to-migrate).

| Phase | Status | Notes |
|---|---|---|
| 1 Foundation | ✅ done | `middleware.ts`, `lib/auth/server.ts`, `lib/permissions`, `lib/db/{client,admin,browser}`. §1.4 trigger was never built — `create_org_member` RPC inserts the stub profile instead. |
| 2 Users | ✅ done | Multi-role memberships, invites (`org_invites` + RPCs), suspend/unsuspend/revoke. 128 unit tests passing. |
| 3 Reference data | ◐ partial | `billing_services` + `service_code_mappings` are in **migration 00012** (not just seed). `matching_rulesets` rows and `notification_templates` rows **not seeded**; ruleset config lives in `src/lib/config/matching-ruleset-v1.json`. |
| 4 Patients | ◐ carry-over | Core patient functionality, §4.6–4.7 UI carry-over, and patient action/service/schema tests are complete. Remaining: patient authorizations (deferred to Phase 6). |
| 5–9 | ⬜ not started | Schema exists for all tables; work is RPCs + app layers only. |
| 10–12 | ⬜ not started | |

**Target:** Phase 9 complete by 2026-09-18. Order: **5 → 6 → 7 → 3 (remaining) → 8 → 9**, Phase 4 fixes interleaved.

**Migrations applied to hosted DB:** `00001`–`00012`. Next: `00013`. Migrations are now deployed via GitHub Actions on push to `main` (see `docs/MIGRATIONS.md` §1 for the one-time baseline you must run first).

**Test baseline:** `npx vitest run` → 8 files, 128 tests passing.

---

## Phase Deliverable Checklist (applies to every implementation phase from Phase 4 onward)

Every phase produces these artifacts; the per-phase sections below list the specifics. Templates for each are in the cheatsheet.

| # | Artifact | Location |
|---|---|---|
| 1 | Migration (RPCs / indexes / policy tweaks) | `supabase/migrations/000NN_<domain>_rpcs.sql` |
| 2 | Types: new enums, joined shapes, **RPC registered in `Database.Functions`** | `src/types/index.ts` |
| 3 | Zod schemas (`.strict()`, `organizationId` first) | `src/lib/schemas/<domain>.schema.ts` |
| 4 | Service (all Supabase calls; org filter on every query) | `src/lib/services/<domain>.service.ts` |
| 5 | Server Actions (auth → validate → permission → service → revalidate) | `src/app/(dashboard)/<route>/actions.ts` |
| 6 | Pages: list / create / `[id]` / `[id]/edit` / sub-routes | `src/app/(dashboard)/<route>/**/page.tsx` |
| 7 | Components: `<Entity>List` (DataGrid), `<Entity>Core`, `<Entity>Form`, `<Entity>Edit` + sub-entity List/Form | `src/app/(dashboard)/<route>/_components/` |
| 8 | Nav entry (+ `PROTECTED_ROUTES` if new top-level path) | `DashboardFrame.tsx`, `middleware.ts` |
| 9 | Tests: actions, service, schema | `tests/unit/{actions,services,schemas}/<domain>.*.test.ts` |
| 10 | `docs/DATABASE.md` updated; plan checkboxes ticked | |

### Optimization requirements (mandatory for Phase 6 onward)

Apply `API_AUTHORIZATION_OPTIMIZATION_PLAN.md` as each new module is built rather than adding an optimization pass later:

- [ ] Server pages reuse the request-local authenticated user, active membership, and identical permission results; no cross-request authorization cache.
- [ ] Organization context comes from the server-resolved active membership, never from a browser-supplied organization ID.
- [ ] Initial server renders call services directly after the page authorization preamble; Server Actions remain for client-triggered reads and mutations and still enforce auth → validation → permission.
- [ ] Paginated lists use explicit projections, database-side filters/counts, deterministic ordering, and URL-backed pagination.
- [ ] Detail pages fetch the parent first, then use a bounded page-specific read model for related data; distinct sensitive permissions remain separate queries.
- [ ] Do not issue one Server Action or Supabase request per displayed row. Resolve derived values in the list/detail query or in one batch RPC.
- [ ] Interactive reads perform no opportunistic maintenance writes. Derive time-based state at read time where feasible.
- [ ] Multi-statement state transitions and limit/uniqueness checks use one transactional RPC plus database constraints where possible.
- [ ] Ordinary user-scoped reads/writes use the cookie-bound client and RLS, never the service-role client.
- [ ] Tests cover organization scope, projections, bounded results, authorization isolation, and the route's Supabase request budget.

Infrastructure-heavy automation such as scheduled expiry jobs, background queues, and external monitoring is a stretch goal unless the phase cannot be correct without it.

---

## MUI Template Integration Pattern

Each MUI template ships as:

```
<template-name>/
  main.js                  ← entry point / page shell
  components/              ← UI building blocks
  internals/               ← shared config (theme tokens, etc.)
  content/                 ← static copy or layout wrappers
  data/                    ← mock/static data
  hooks/                   ← local state and data-fetching hooks
  theme/customizations/    ← MUI theme overrides
```

**How to wire a template to real data:**

1. Copy the template directory into the matching `src/` location (page or component folder).
2. Convert `main.js` to a Next.js page component (`page.tsx`) — keep the JSX shell, remove mock wiring.
3. Replace `data/` stubs with imports from the relevant service layer (`lib/services/`).
4. Replace `hooks/` data-fetching with Server Action calls or `useQuery`-style wrappers over Server Actions.
5. Keep `internals/`, `content/`, and `theme/customizations/` largely as-is; adjust tokens to match the project theme if needed.
6. All mutations (form submits) go through a Server Action → service → Supabase chain. Never call Supabase directly from a template component.

---

## Folder Structure (target)

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          ← redirect to /dashboard
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── logout/page.tsx
│   ├── dashboard/page.tsx
│   ├── patients/
│   │   ├── page.tsx
│   │   └── [patientId]/page.tsx
│   ├── caregivers/
│   │   ├── page.tsx
│   │   └── [caregiverId]/page.tsx
│   ├── shifts/
│   │   ├── page.tsx
│   │   └── [shiftId]/page.tsx
│   ├── call-offs/
│   │   ├── page.tsx
│   │   └── [callOffId]/page.tsx
│   └── settings/
│       └── users/page.tsx
├── components/
│   ├── forms/
│   │   ├── patient-form.tsx
│   │   ├── caregiver-form.tsx
│   │   ├── shift-form.tsx
│   │   ├── report-call-off-form.tsx
│   │   ├── outreach-record-form.tsx
│   │   ├── unresolved-coverage-form.tsx
│   │   └── manual-override-form.tsx
│   ├── tables/
│   │   ├── matching-results-table.tsx
│   │   └── replacement-candidates-table.tsx
│   ├── dashboard/                        ← metric cards, queues, charts
│   ├── layout/                           ← nav, sidebar, shell
│   └── shared/                           ← badges, status chips, guards
├── lib/
│   ├── auth/
│   │   ├── server.ts                     ← getSession, requireAuth helpers
│   │   └── middleware.ts
│   ├── db/
│   │   ├── client.ts                     ← createServerClient (server-side)
│   │   └── browser.ts                    ← createBrowserClient
│   ├── permissions/
│   │   └── index.ts                      ← hasPermission, getOrgMembership
│   ├── schemas/
│   │   ├── patients.schema.ts
│   │   ├── caregivers.schema.ts
│   │   ├── authorizations.schema.ts
│   │   ├── shifts.schema.ts
│   │   ├── matching.schema.ts
│   │   ├── call-offs.schema.ts
│   │   └── users.schema.ts
│   └── services/
│       ├── patients.service.ts
│       ├── caregivers.service.ts
│       ├── authorizations.service.ts
│       ├── shifts.service.ts
│       ├── matching.service.ts
│       ├── distance.service.ts
│       ├── callOffs.service.ts
│       ├── notifications.service.ts
│       ├── dashboard.service.ts
│       ├── users.service.ts
│       └── operational-history.service.ts
├── types/
│   └── index.ts                          ← DB row types, service response types
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/

supabase/
├── migrations/
├── seed/
├── policies/
└── functions/
```

---

## Phase 1 — Project Foundation

**Goal:** Working Next.js app with auth, Supabase connection, and permission utilities.

### 1.1 Environment and Supabase clients

- [ ] Set up `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_LOCATION_ROUTE_CALCULATOR_NAME`
- [ ] Create `src/lib/db/client.ts` — `createServerClient` using `@supabase/ssr` with cookie handling for Server Components and Server Actions
- [ ] Create `src/lib/db/browser.ts` — `createBrowserClient` for client components
- [ ] Confirm `service_role` key is server-only and never exposed to the browser

### 1.2 Auth middleware

- [ ] Create `middleware.ts` at project root — refresh session on every request using `@supabase/ssr`
- [ ] Redirect unauthenticated users to `/login` for all protected routes
- [ ] Redirect authenticated users away from `/login`

### 1.3 Auth pages (MUI template)

- [ ] Wire template into `src/app/(auth)/login/page.tsx`
  - Template: `main.js` → page shell, form in `components/`
  - Action: call `supabase.auth.signInWithPassword()` from a Server Action
  - On success: redirect to `/dashboard`
  - Errors: display safe message, no technical details
- [ ] Create `src/app/(auth)/logout/page.tsx` — call `supabase.auth.signOut()`, redirect to `/login`

### 1.5 Auth helpers

- [ ] Create `src/lib/auth/server.ts`:
  - `getSession()` — get current session from Supabase, throw if unauthenticated
  - `requireAuth()` — wraps `getSession()`, used at the top of every Server Action
  - `getOrgMembership(orgId)` — fetch active membership for current user + org
- [ ] Create `src/lib/permissions/index.ts`:
  - `hasPermission(orgId, permCode)` — calls RPC `has_org_permission` or replicates logic server-side
  - `requirePermission(orgId, permCode)` — throws safe auth error if denied
  - `isOrgAdmin(orgId)` — sugar around `hasPermission` with `users.manage`

### 1.6 Base TypeScript types

- [ ] Generate or hand-write `src/types/index.ts` from schema:
  - Row types for all tables (or use Supabase CLI `gen types typescript`)
  - Service response shape: `{ success: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>; requestId?: string }`
  - Enums for statuses, roles, permission codes

---

### 1.4 user_profiles trigger — SUPERSEDED

- [x] ~~Trigger on `auth.users`~~ Not built. `create_org_member` RPC (migration 00008) inserts a stub `user_profiles` row (`first_name`/`last_name` nullable) at invite time; `complete_org_invite` fills it on acceptance. Do not add a trigger.


## Phase 2 — User Management

**Goal:** Agency Administrator can invite users, assign roles, and manage access.

### 2.1 User service

- [ ] Create `src/lib/services/users.service.ts`:
  - `listOrgMembers(orgId)` — return members with profile info
  - `inviteUser(orgId, email, role)` — call `supabase.auth.admin.inviteUserByEmail()` + create membership
  - `updateMemberRole(orgId, membershipId, role)` — admin-only
  - `suspendMember(orgId, membershipId)` — set status = Suspended
  - `revokeMember(orgId, membershipId)` — set status = Revoked

### 2.2 User schemas

- [ ] Create `src/lib/schemas/users.schema.ts`:
  - `InviteUserSchema` — email, role (validated against enum)
  - `UpdateRoleSchema` — role
  - All schemas use `.strict()` (reject unknown fields)

### 2.3 Settings / Users page (MUI template)

- [ ] Wire template into `src/app/settings/users/page.tsx`
  - Template `data/` → replace with `users.service.listOrgMembers()`
  - Invite form → Server Action → `users.service.inviteUser()`
  - Role/status change → Server Action → `users.service.updateMemberRole()` or `suspendMember()`
  - Permission guard: only Agency Administrator can access

---

## Phase 3 — Platform Reference Data Seed

**Goal:** Billing services, EVV mappings, notification templates, and matching rulesets are available.

**Scheduled after Phase 7** (timeline: Aug 29–Sep 4). Everything here is a single migration — no app code except types.

### 3.1 Billing services and EVV mappings — DONE

- [x] Migration `00012_billing_services_and_service_code_mappings.sql` inserts 16 `billing_services` + 22 `service_code_mappings` (idempotent `on conflict … do update`). Seed files `supabase/seed/billing_services.sql` / `service_code_mappings.sql` are now redundant.

### 3.2 Matching rulesets

- [ ] Migration `00018_seed_rulesets_and_templates.sql` — insert `matching_rulesets (ruleset_key='matching_ruleset', version='v1', configuration=<json below>, active=true)` with `on conflict (ruleset_key, version) do update set configuration = excluded.configuration`.
- [ ] Types: add `MatchingRuleset` row type + `matching_rulesets: TableDef<MatchingRuleset>` to `Database.Tables`; add `MatchingRulesetConfig` type matching the JSON shape.
- [ ] Service: `matching.service.ts#getActiveRuleset(key)` reads DB row; falls back to `src/lib/config/matching-ruleset-v1.json` if none. Existing test `tests/unit/config/matching-ruleset.test.ts` keeps validating the JSON.
- [ ] Configuration JSON should include:
  ```json
  {
    "weights": { "qualification": 0.40, "availability": 0.25, "travel": 0.20, "preference": 0.10, "schedule": 0.05 },
    "travel": { "preferred_minutes": 25, "max_minutes": 45, "review_threshold_minutes": 40 },
    "availability": { "min_overlap_pct": 50, "review_overlap_pct": 95 },
    "score_thresholds": { "recommended": 80, "review_required": 60 }
  }
  ```

### 3.3 Notification templates

- [ ] Same migration `00016` — insert MVP templates (`on conflict (template_key, version) do update`), all `version = 'v1'`, `active = true`:
  - `call_off.reported` — Internal Staff, In-App, Operational — vars: `shift_date, shift_time_range, service_name, caregiver_first_name, call_off_id`
  - `replacement.candidate_outreach` — Caregiver, SMS — General — vars: `shift_date, shift_time_range, service_name, city, zip_prefix, respond_by`
  - `assignment.confirmed` — Internal Staff, In-App, Operational — vars: `shift_date, shift_time_range, caregiver_first_name, caregiver_last_initial, shift_id`
  - `shift.uncovered_alert` — Internal Staff, In-App, Operational — vars: `shift_date, shift_time_range, service_name, shift_id`
  - Each template declares `allowed_variables` and `sensitivity_classification`. Never include `patient_*`, `address_line_*`, `auth_number`, `diagnosis` in `allowed_variables`.
- [ ] Types: `NotificationTemplate` already exists; add `NOTIFICATION_TEMPLATE_KEYS` const array + `NotificationTemplateKey` type.
- [ ] Test: `tests/unit/config/notification-templates.test.ts` — asserts no disallowed variable names appear in the template list (guard file duplicated as `src/lib/config/notification-templates.json` for unit testing without DB).
- [ ] Matching config items from the timeline (matching priorities, travel-time guidelines, min availability, recommended/review thresholds) are **all covered by the ruleset JSON in §3.2** — no separate settings UI for MVP.

---

## Phase 4 — Patient Module

**Goal:** Patients can be created, viewed, and managed with role-based field visibility.

### 4.1 Patient service

- [ ] Create `src/lib/services/patients.service.ts`:
  - `listPatients(orgId, filters?)` — returns basic fields only; no clinical fields
  - `getPatient(orgId, patientId, role)` — returns fields filtered by role and `visibility_level`
  - `createPatient(orgId, userId, data)` — validates + inserts patient + address rows
    - also want to a confirm patient data by another admin, so that if its wrong/mistake, can be deleted fully before needing to be archived
  - `updatePatient(orgId, patientId, userId, data)` — validates + updates, preserves `organization_id`
  - `listPatientRequirements(orgId, patientId, visibilityLevel)` — applies visibility filter
  - `upsertPatientRequirement(orgId, patientId, userId, data)` — structured operational rule
  - `archivePatient(orgId, patientId, userId)` — sets `archived_at`, not DELETE

### 4.2 Patient schemas

- [ ] Create `src/lib/schemas/patients.schema.ts`:
  - `CreatePatientSchema` — required: first_name, last_name; optional: date_of_birth, patient_external_id, etc.
  - `UpdatePatientSchema` — same fields as create, all optional except at least one required
  - `PatientRequirementSchema` — requirement_type, requirement_code, matching_effect, visibility_level
  - `PatientListResponseSchema` — basic fields only (no date_of_birth in list view)

### 4.3 Patients list page (MUI template)

- [ ] Wire template into `src/app/patients/page.tsx`
  - Template `data/` → Server Action → `patients.service.listPatients()`
  - Template table/grid component wired to returned rows
  - Status filter chip group (Intake, Active, Suspended, Discharged)
  - "Add Patient" button → opens form drawer/modal
  - Permission guard: `patients.read_basic`

### 4.4 Patient detail page (MUI template)

- [ ] Wire template into `src/app/patients/[patientId]/page.tsx`
  - Load patient + requirements via Server Action
  - Clinical/Restricted tabs shown only if user has `patients.read_clinical`
  - Edit form → Server Action → `patients.service.updatePatient()`
  - Requirements section — add/edit requirement rows, visibility selector
  - Address section — service address management



### 4.5 Implemented (as of 2026-09-09)

- [x] `patients.service.ts`, `patients.schema.ts`, `patients/actions.ts` (list/get/create/update/archive, addresses, requirements)
- [x] Migration `00011_patient_rpcs.sql`: `create_patient_with_address`, `upsert_patient_requirement`, `list_patient_requirements_by_visibility`
- [x] Routes: `/patients`, `/patients/[id]`, `/[id]/edit`, `/[id]/address{,/new,/[addressId]/edit}`, `/[id]/requirement{,/new,/[requirementId]/edit}`; placeholders for `/contact`, `/authorization`, `/matching`
- [x] Patient editing is split across multiple pages (core / address / requirement) — this is the convention for all entities.

### 4.6 Carry-over (do alongside Phase 5; each item is small)

- [x] **Route** `src/app/(dashboard)/patients/create/page.tsx` + `_components/PatientCreate.tsx` — `PatientList` already links to `/patients/create`; currently 404s. Form = `PatientForm` fields + optional inline service address; calls `createPatientAction`.
- [x] **Types**: register `create_patient_with_address`, `upsert_patient_requirement`, `list_patient_requirements_by_visibility`, `revoke_org_member` in `Database.Functions`; remove the `as never` casts in `patients.service.ts` / `users.service.ts`. Make `UserProfile.first_name/last_name` `string | null`.
- [x] **Schema**: `UpdatePatientSchema` — add `.refine` preventing `status: 'Archived'` via update (must use `archivePatientAction`).
- [x] **Service**: `listPatients` — exclude `archived_at is not null` rows unless `filters.status === 'Archived'`. `getPatient` currently ignores `role`; clinical filtering is done by `list_patient_requirements_by_visibility`, so drop `role` from the §4.1 signature (no change needed) — but the detail page must pass `visibilityLevel` based on `hasPermission(orgId,'patients.read_clinical')` instead of listing all.
- [x] **Tests**: `tests/unit/actions/patients.actions.test.ts` (every action: success / unauth / forbidden / fieldErrors / strict), `tests/unit/services/patients.service.test.ts` (RPC args, org filter, error paths, address/contact/requirement cardinality and deactivation), `tests/unit/schemas/patients.schema.test.ts`.
- [x] `patient_contacts`: service `listPatientContacts` / `upsertPatientContact` / `deactivatePatientContact` (direct table writes — RLS covers), `PatientContactSchema`, actions, `/contact` list + `/contact/new` + `/contact/[contactId]/edit` pages, `ContactList`/`ContactForm`. Low priority — only if time allows before Phase 9.
- [x] Bug reported in timeline ("not behaving consistently"): verify `createPatientAction` sends `date_of_birth` as `YYYY-MM-DD` (service currently re-parses through `new Date()` → timezone shift risk; pass the string through unchanged).

### 4.7 Backlog — must clear before starting Phase 5 (captured 2026-09-09)

- [x] **Requirements — operational choices**: patient-facing requirements are limited to Language (common-language list plus Other), Gender Preference (Male/Female), and minimum patient lifting capacity (150/200/250 lb plus Other). Internal requirement codes, matching effect, skill code, and visibility are not displayed.
- [x] **Requirements — optional dates**: effective dates remain available but are optional and remain `null` when omitted (migration `00013`).
- [ ] **Patient authorizations**: full slice for `patient_authorizations` + `authorization_services` (schema → service → actions → `/authorization{,/new,/[id]/edit}` pages → components). Replaces the current placeholder page. Overlaps Phase 6. **⚠️ DEFERRED to Phase 6 (2026-09-10)** — everything else in §4.7 was completed without it; `TODO(phase-6/authorizations)` markers are left in `patients/[patientId]/authorization/page.tsx` and `_components/PatientCore.tsx`.
- [x] **Address archive**: soft-delete/archive for `patient_addresses` (set `active = false` + `archived_at`) with a Delete action in `PatientAddressList`, mirroring `deactivatePatientContact`.
- [x] **Date of birth mandatory**: make `date_of_birth` required in `CreatePatientSchema` / `UpdatePatientSchema` and in the create/edit forms.
- [x] **Patient detail readability**: make the `PatientCore` info display more compact and easier to scan.
- [x] **Patient detail subheader**: add a short description under the title in the single-patient view explaining what the page is for.
- [x] **Patient detail loading**: fetch the patient row first, then stream independent address/contact/requirement previews (three displayed rows plus one sentinel row) so child tables do not block the core page. Show centered `View more` navigation only when a fourth row exists.
- [x] **Phase 4 query scope**: patient list uses server-side pagination and a list-only column projection; edit routes fetch one child row by composite scope instead of loading a whole child table; server pages call services directly after their auth/permission preamble instead of repeating checks through read actions.
- [x] **Patient hub status tooltips**: add `Tooltip`s on the status `Chip`s in `PatientList` explaining Intake / Active / Suspended / Discharged / Archived. **TEMPORARY:** operational definitions are visibly marked `UNCONFIRMED` and have `TODO(patient-statuses)` pending team confirmation; only Archived/default-list behavior is documented.
- [x] **Service tests**: `tests/unit/services/patients.service.test.ts` (plus the actions/schema test files from §4.6).
- [x] **Clean up all lint + compile errors**: patient files are green as of 2026-09-10. The remaining `settings/users/**` errors were cleared on 2026-09-21 (MUI v9 migration: Typography system props `fontWeight`/`display` moved into `sx`; `DataGrid rowMinHeight` removed in X v9, replaced with a `gridClasses.row` `minHeight` rule; dropped the unused `membershipId` prop passed to `MemberEdit`). `npm run build` now exits 0.

---

## Phase 5 — Caregiver Module

**Goal:** Caregivers can be created, credentialed, and managed with compensation fields gated by permission.

**Permissions:** read = `caregivers.manage` (Scheduler reads via `shifts.manage`/`matching.run` OR-clauses in RLS); write = `caregivers.manage`; compensation read/write additionally `caregivers.read_compensation`.

### 5.0 Migration `00014_caregiver_rpcs.sql`

- [x] Helper `can_manage_org_caregivers(org_id)` → `has_org_permission(org_id, 'caregivers.manage')`; `can_read_org_compensation(org_id)`.
- [x] `create_caregiver(target_org_id, first_name, last_name, classification, email default null, phone default null, employee_external_id default null, max_hours_per_week numeric default null, service_area_zip default null, travel_radius_miles numeric default null) returns caregivers` — validates classification, stamps `created_by_user_id = auth.uid()`. (RPC rather than direct insert so `created_by_user_id` can never be spoofed.)
- [x] `upsert_caregiver_availability(target_org_id, target_caregiver_id, day_of_week smallint, start_time time, end_time time, availability_status text, effective_start_date date, effective_end_date date default null) returns caregiver_availability` — rejects `end_time <= start_time`; rejects overlap with an existing window on the same `day_of_week` whose effective range intersects (raise `'Availability window overlaps an existing window'`).
- [x] `set_caregiver_compensation_rate(target_org_id, target_caregiver_id, pay_rate numeric, rate_unit text, effective_start_date date, organization_service_id uuid default null) returns caregiver_compensation_rates` — requires manage **and** read_compensation; sets `effective_end_date = effective_start_date - 1` and `active = false` on the current active rate for the same `organization_service_id` (null-safe), inserts new row with `approved_by_user_id = auth.uid(), approved_at = now()`.
- [x] `mark_expired_credentials(target_org_id) returns integer` — `update caregiver_credentials set status='Expired' where expiration_date < current_date and status='Active'`; returns count. Called by `listCaregivers` opportunistically (cheap) so "expired" is never stale.
- [x] ~~`alter table caregiver_availability_exceptions add column active boolean not null default true;`~~ **REMOVED (2026-09-20)** — migration `00015_drop_caregiver_availability_exceptions.sql` drops the table entirely; availability exceptions were redundant with `caregiver_availability` effective date ranges.
- [x] Register all four in `Database.Functions`. Update `docs/DATABASE.md` §6.5, §10.

### 5.1 Types (`src/types/index.ts`)

- [x] `export const CAREGIVER_CLASSIFICATIONS = ['RN','LPN','HHA','STNA'] as const` (derive `CaregiverClassification` from it).
- [x] `CaregiverCredentialStatus` already = `CredentialStatus`. Add `CREDENTIAL_TYPES = ['License','Certification','Background Check','CPR','TB Test','Other'] as const` + type — `credential_type` is free `text` in SQL, so the app constrains it.
- [x] Joined shapes: `CaregiverWithCredentialSummary = Caregiver & { credentials: Pick<CaregiverCredential,'id'|'credential_type'|'expiration_date'|'status'>[] }` (for list "credential warning" chip); `CaregiverDetail = Caregiver & { credentials, skills, service_eligibility, availability, constraints }`.
- [x] `CredentialHealth = 'OK' | 'Expiring Soon' | 'Expired' | 'Missing'` + pure fn `getCredentialHealth(credentials, today, windowDays=30)` in `caregivers.service.ts` (no Supabase → unit-testable).

### 5.2 Schemas (`src/lib/schemas/caregivers.schema.ts`)

All `.strict()`, `organizationId` first, `caregiverId` second on sub-entities.

- [x] `CreateCaregiverSchema` — required `first_name, last_name, classification`; optional nullable `email (z.string().email())`, `phone`, `employee_external_id`, `max_hours_per_week (0–168)`, `service_area_zip (5 digits)`, `travel_radius_miles (0–200)`.
- [x] `UpdateCaregiverSchema` — same optional + `employment_status`, `matching_status`; refine ≥1 data field.
- [x] `ArchiveCaregiverSchema` — `{ organizationId, caregiverId }`.
- [x] `UpsertCredentialSchema` — `credentialId?` (present = update), `credential_type` (enum), `credential_name`, `credential_number?` (plain text input → stored in `encrypted_credential_number` **as-is for MVP**; mark TODO encrypt), `issued_date?`, `expiration_date?`, `status`; refine `expiration_date >= issued_date`.
- [x] `UpsertSkillSchema` — `skillId?`, `skill_code`, `skill_name`, `verified_at?`, `expires_at?`.
- [x] `UpsertServiceEligibilitySchema` — `organization_service_id`, `supervision_required` (default false).
- [x] `UpsertAvailabilitySchema` — `day_of_week` (int 0–6), `start_time`, `end_time` (`HH:MM`), `availability_status`, `effective_start_date`, `effective_end_date?`; refine `end_time > start_time`.
- [x] ~~`UpsertAvailabilityExceptionSchema`~~ — **REMOVED (2026-09-20)**, see §5.0.
- [x] `SetCompensationRateSchema` — `pay_rate` (positive, 2dp), `rate_unit`, `effective_start_date`, `organization_service_id?`.
- [x] `DeactivateSubEntitySchema` — `{ organizationId, caregiverId, <sub>Id }` — one generic schema reused for skill/eligibility/availability deactivation, or one per sub-entity if ids differ in name.

### 5.3 Service (`src/lib/services/caregivers.service.ts`)

- [x] `listCaregivers(orgId, filters?: { classification?, employment_status?, matching_status?, includeArchived? })` — `select('*, credentials:caregiver_credentials(id,credential_type,expiration_date,status)')`, `archived_at is null` unless `includeArchived`, order `last_name`. **Never** embeds `caregiver_compensation_rates`.
- [x] `getCaregiver(orgId, caregiverId)` → `Caregiver | null` (core row only).
- [x] `getCaregiverDetail(orgId, caregiverId)` → `CaregiverDetail | null` — embeds credentials, skills, eligibility, availability, constraints (all `active=true` where applicable). No compensation.
- [x] `createCaregiver(orgId, userId, data)` → RPC `create_caregiver`.
- [x] `updateCaregiver(orgId, caregiverId, userId, data)` → direct update with `updated_by_user_id/updated_at`.
- [x] `archiveCaregiver(orgId, caregiverId, userId)` → `archived_at=now(), employment_status='Inactive', matching_status='Inactive'`.
- [x] Credentials: `listCredentials`, `upsertCredential` (insert or update by id), `verifyCredential(orgId, caregiverId, credentialId, userId)` (sets `verified_by_user_id/verified_at`), `revokeCredential` (status Revoked).
- [x] Skills: `listSkills`, `upsertSkill`, `deactivateSkill`.
- [x] Eligibility: `listServiceEligibility(orgId, caregiverId)` — embed `organization_services(local_service_name, service_code_mappings(evv_service_name))`; `upsertServiceEligibility(orgId, caregiverId, userId, data)` — deactivate existing for same service then insert with `approved_by_user_id=userId, approved_at=now()`; `deactivateServiceEligibility`.
- [x] Availability: `listAvailability`, `upsertAvailability` → RPC, `deactivateAvailability` (sets `effective_end_date = today`). ~~Availability exceptions~~ **REMOVED (2026-09-20)**, see §5.0.
- [x] Compensation: `listCompensationRates(orgId, caregiverId)`, `setCompensationRate(orgId, caregiverId, userId, data)` → RPC. Kept in the same file but exported under clear names; actions gate them.
- [x] Pure: `getCredentialHealth(credentials, today, windowDays)`; `listCaregiversWithCredentialIssues(orgId)` — filters `listCaregivers` result by health ≠ OK (used by dashboard later).

### 5.4 Actions (`src/app/(dashboard)/caregivers/actions.ts`)

One action per service fn above. Read perm `caregivers.manage`; write perm `caregivers.manage`; compensation actions call `requirePermission(orgId,'caregivers.manage')` **and** `requirePermission(orgId,'caregivers.read_compensation')`. `revalidatePath('/caregivers')` on create/archive, `/caregivers/${id}` on everything else.

### 5.5 Pages & components

Routes (all with the standard preamble; read perm on list/detail, `caregivers.manage` on mutations):

```
/caregivers                                   CaregiverList   (filters: classification Select, status Select [Active/Inactive/Suspended/Archived])
/caregivers/create                            CaregiverCreate
/caregivers/[caregiverId]                     CaregiverCore   (sections: Profile · Credentials (health chip) · Skills · Service Eligibility · Availability · Compensation [only if canReadCompensation])
/caregivers/[caregiverId]/edit                CaregiverEdit
/caregivers/[caregiverId]/credential          CredentialList   + /new + /[credentialId]/edit → CredentialForm
/caregivers/[caregiverId]/skill               SkillList        + /new → SkillForm
/caregivers/[caregiverId]/eligibility         EligibilityList  + /new → EligibilityForm (Select of org services from listOrgServicesAction — Phase 6; until then a plain uuid TextField)
/caregivers/[caregiverId]/availability        AvailabilityList (grid rows = windows; columns day/start/end/status/effective) + /new → AvailabilityForm
/caregivers/[caregiverId]/compensation        CompensationList + /new → CompensationForm   (page checks caregivers.read_compensation; else UnauthorizedMessage)
```

- [x] Detail page computes `canReadCompensation = await hasPermission(orgId,'caregivers.read_compensation')` and passes it to `CaregiverCore`.
- [x] `CaregiverList` credential column: `Chip` colored by `getCredentialHealth` (`OK` success · `Expiring Soon` warning · `Expired`/`Missing` error).
- [x] Nav: `{ id:'caregivers', title:'Caregivers', icon:<BadgeIcon/>, href:'/caregivers' }` after Patients. `/caregivers` already in `PROTECTED_ROUTES`.

### 5.6 Implemented (as of 2026-09-16) — deviations from the bullets above

- [x] Migration `00014_caregiver_rpcs.sql`; `caregivers.schema.ts`, `caregivers.service.ts`, `caregivers/actions.ts`; all routes in §5.5 plus `/skill/[skillId]/edit`.
- [x] **Query patterns (`QUERY_PERFORMANCE_BACKLOG.md`)**: `listCaregivers` returns `{ rows, rowCount }` with URL-backed server pagination (`page`/`pageSize`) and a **list-only projection** (no compensation, no credential numbers); the detail page fetches the caregiver first and streams five previews (three rows plus one sentinel for `View more`); full child collections load only on their dedicated routes; edit routes use scoped single-record reads (`getCredential`, `getSkill`).
- [x] **`getCaregiverDetail` / `CaregiverDetail` intentionally not built** — a single embed of every child table contradicts the parent-first streaming rule; `CaregiverCore` receives one promise per section instead.
- [x] **`getCredentialHealth` lives in `caregivers.schema.ts`** (pure, no Supabase) and is re-exported from `caregivers.service.ts`, so `CaregiverList` / `CaregiverCore` can import it without pulling the server Supabase client into the browser bundle — same pattern as `getPatientRequirementDisplayValue`.
- [x] **Skills follow the patient requirement reform**: the UI offers only Language / Gender / Lifting with curated options (common languages plus Other, Male/Female, 150/200/250 lb plus Other). `skill_code` is derived (`LANGUAGE:`, `GENDER:`, `CAREGIVER_LIFTING_MAX_LB:`) and never typed; `UpsertSkillSchema` validates the prefix; `upsertSkill` keeps one active row per code; `getCaregiverSkillDisplayValue` renders list and preview rows.
- [x] Deactivation schemas are one per sub-entity (`DeactivateSkillSchema`, `DeactivateServiceEligibilitySchema`, `DeactivateAvailabilitySchema`) because the id names differ.
- [x] **List status filter is one Select, not chips**: `CAREGIVER_STATUS_FILTERS = ['Active','Inactive','Suspended','Archived']` replaces the separate `matching_status` chips and "Show archived" toggle. `listCaregivers` takes a single `status` filter — `Archived` matches `archived_at is not null`, anything else matches `matching_status` on non-archived rows. URL param is `?status=`; the grid's `matching_status` column is titled **Status** and renders `Archived` for archived rows.
- [x] Compensation is gated twice: `listCompensationRatesAction` / `setCompensationRateAction` call `requirePermission(orgId,'caregivers.manage')` **and** `requirePermission(orgId,'caregivers.read_compensation')`; the `/compensation` routes re-check both; `CaregiverCore` hides the section unless `canReadCompensation`; `set_caregiver_compensation_rate` re-checks both in SQL.
- [ ] Credential numbers are stored verbatim in `encrypted_credential_number` (`TODO(encrypt-credential-number)`), and the eligibility/compensation forms take a raw `organization_service_id` until Phase 6 exposes an org-service list.

### 5.7 Tests

- [x] `tests/unit/schemas/caregivers.schema.test.ts` — every schema except service eligibility: valid, enum reject, strict reject, refinements (`end_time > start_time`, `day_of_week` bounds, skill code prefixes). Service-eligibility coverage is deferred while that feature remains under review.
- [ ] `tests/unit/services/caregivers.service.test.ts` — every service except service eligibility: `listCaregivers` never selects compensation; RPC arg mapping for `create_caregiver`, `upsert_caregiver_availability`, `set_caregiver_compensation_rate`; `getCredentialHealth` table-driven cases (no creds → Missing; expired → Expired; 10 days out → Expiring Soon; 60 days → OK). Service-eligibility coverage is deferred while that feature remains under review.
- [ ] `tests/unit/actions/caregivers.actions.test.ts` — standard matrix for every action; compensation actions assert **both** permission calls; `archiveCaregiverAction` revalidates `/caregivers`.

---

## Phase 6 — Authorization Module

**Goal:** Patient authorizations and approved service rates are configured and usable by Shift and Matching services.

**Permissions:** payers/org services read = any org member (RLS `is_org_member`), write = `authorizations.manage`. `patient_authorizations` read/write = `authorizations.manage`. `authorization_services` read = `authorizations.manage` **or** `shifts.manage`.

### 6.0 Optimization integration

- [x] Request-local memoization now shares `getSession`, active/org membership, and identical permission checks across server component trees; Phase 6 pages must consume these helpers when built.
- [x] Add URL-backed server pagination and explicit list projections for payers, organization services, and patient authorizations.
- [x] Build an authorization detail read model that returns the parent and bounded service rows with effective rates in one request; do not invoke one raw-rate request per displayed service.
- [x] Keep encrypted prior-authorization data out of every list/detail projection and return only the masked value.
- [ ] Keep RLS authoritative and retain action permission checks; use `requireAnyPermission` for the documented read boundary without duplicating identical checks in one render.

### 6.0.1 Rate visibility and downstream validation plan

The authorization module separates raw financial reads from scheduler-safe validation:

- [x] Add `authorizations.read_rates` to `PermissionCode`, the permission-default seed, `docs/DATABASE.md`, and the database permission model. Assign it only to roles that may view reimbursement amounts; do not infer it from `shifts.manage`.
- [x] Change raw financial rate reads (batched authorization-detail rate values and rate-management UI) to require `authorizations.manage` **or** `authorizations.read_rates`.
- [x] Add `check_authorization_service_compatibility(target_org_id, target_patient_id, target_organization_service_id, service_date)` as a scheduler-safe, `security definer` RPC. It must require `authorizations.manage` **or** `shifts.manage`, validate patient/service organization scope, and return only non-financial fields: `authorization_valid`, `service_authorized`, `has_rate`, `reason_code`, and a generalized `rate_source`/compatibility status. It must never return an amount or rate unit.
- [x] Add a typed `AuthorizationServiceCompatibility` result and a service wrapper. Phase 7 shift creation, Phase 8 matching, and Phase 9 replacement confirmation must call this safe contract for authorization/rate validation.
- [x] Keep raw rate resolution available only to authorized financial users. Matching and call-off responses expose only compatibility flags/reason codes unless their caller separately has `authorizations.read_rates`.
- [ ] Add RLS/RPC tests proving a Scheduler receives compatibility results but cannot retrieve a raw rate, while a permitted financial reader can.

### 6.0.2 Rate effective-dating plan

- [x] Current organization-service defaults are mutable rows, so rate changes can affect historical fallback calculations. Before exposing rate editing, add an append-only `organization_service_rates` table keyed by organization/service with `reimbursement_rate`, `rate_unit`, `effective_start_date`, nullable `effective_end_date`, `change_reason`, actor, and timestamps.
- [x] Add a database constraint/index that prevents two organization-service rate periods from overlapping. Migrate existing non-null organization-service default rates into a documented baseline rate row; do not invent unverified historical rates.
- [x] Replace direct updates to `organization_services.default_reimbursement_rate` / `default_rate_unit` with a transactional `set_organization_service_rate(...)` RPC. It accepts only `effective_start_date >= current_date`, closes the preceding active range at `new_start - 1`, inserts the new version, and records an operational event.
- [ ] Rate-management UI defaults the effective date to today and does not expose an ordinary backdate control.
- [x] Resolve effective rate in this order: applicable authorization-service rate, then the one applicable `organization_service_rates` version, then `missing`. Preserve authorization-service rates as the first-priority source.
- [x] Update `pickEffectiveRate`, batched effective-rate projections, types, schemas, and tests to use the rate-history model; retire mutable default-rate reads after all consumers migrate.
- [ ] Add tests for prospective changes, closed prior ranges, overlap rejection, and historical effective-rate resolution.

### 6.1 Migration `00016_authorization_rpcs.sql`

- [x] **Policy tweak:** `drop policy "patient_authorizations: read with authorizations.manage"` and recreate as `using (has_org_permission(organization_id,'authorizations.manage') or has_org_permission(organization_id,'shifts.manage'))` — Schedulers must see the parent authorization when creating shifts. Update `docs/DATABASE.md` §5.
- [x] `create_authorization_with_services(target_org_id, target_patient_id, target_payer_id, authorization_start_date date, authorization_end_date date, status text default 'Active', prior_auth_number text default null, services jsonb default '[]') returns patient_authorizations` — validates dates (`end >= start`), payer + patient belong to org, status enum; stores `masked_prior_auth_number = '****' || right(prior_auth_number, 4)` and `encrypted_prior_auth_number = prior_auth_number` (**TODO encrypt** — pgsodium/Vault post-MVP); loops `services` array `[{organization_service_id, authorized_quantity, quantity_unit, quantity_period, reimbursement_rate, rate_unit, effective_start_date, effective_end_date}]` inserting `authorization_services` with effective dates defaulting to the authorization dates. Transactional.
- [x] Do not call an expiry mutation from `listPatientAuthorizations`. Treat an authorization past `authorization_end_date` as effectively expired in list/detail projections and eligibility queries while preserving the stored workflow status.
- [ ] **Stretch goal:** `expire_authorizations(target_org_id) returns integer` — idempotently persist `status='Expired'` where `authorization_end_date < current_date and status in ('Active','Pending Recertification')`; invoke from a scheduled maintenance job only if integrations/reporting require persisted expiry.
- [x] Register in `Database.Functions`.

### 6.2 Types

- [x] `export const PAYER_TYPES`, `AUTHORIZATION_STATUSES`, `QUANTITY_UNITS`, `QUANTITY_PERIODS`, `RATE_UNITS` const arrays (types already exist as unions — convert to derived).
- [x] `OrganizationServiceWithMapping = OrganizationService & { service_code_mapping: Pick<ServiceCodeMapping,'evv_service_id'|'evv_service_name'|'payer_type'|'program_name'> & { billing_service: Pick<BillingService,'billing_code'|'service_name'|'service_category'> } }`.
- [x] `PatientAuthorizationWithServices = PatientAuthorization & { payer: Pick<Payer,'payer_name'|'payer_type'>; services: (AuthorizationService & { organization_service: Pick<OrganizationService,'local_service_name'> })[] }`. Never includes `encrypted_prior_auth_number` — use `Omit<>`.
- [x] `EffectiveRate = { rate: number | null; rate_unit: RateUnit | null; source: 'authorization' | 'organization_default' | 'missing' }`.

### 6.3 Schemas (`src/lib/schemas/authorizations.schema.ts`)

- [x] `UpsertPayerSchema` — `payerId?`, `payer_name`, `payer_type`, `program_name?`, `status?`.
- [x] `ActivateOrgServiceSchema` — `service_code_mapping_id`, `local_service_name?`, `default_reimbursement_rate?`, `default_rate_unit`, `requires_clinical_approval` (default false).
- [x] `UpdateOrgServiceSchema` — `organizationServiceId` + optional `local_service_name, default_reimbursement_rate, default_rate_unit, requires_clinical_approval, enabled`; refine ≥1.
- [x] `AuthorizationServiceInputSchema` (nested, no `organizationId`) — `organization_service_id, authorized_quantity (>0), quantity_unit, quantity_period, reimbursement_rate?, rate_unit, service_requirement_code?, effective_start_date?, effective_end_date?`.
- [x] `CreateAuthorizationSchema` — `patientId, payer_id, authorization_start_date, authorization_end_date, status?, prior_auth_number?, services: z.array(AuthorizationServiceInputSchema).default([])`; refine `end >= start`.
- [x] `UpdateAuthorizationSchema` — `authorizationId` + optional `payer_id, dates, status`; refine ≥1 and `end >= start` when both present. Status transitions allowed: `Active ↔ Under Review`, `Active → Pending Recertification → Active`, `Active|Pending Recertification → Suspended → Active`, anything → `Expired`. Encode as `ALLOWED_AUTH_TRANSITIONS: Record<AuthorizationStatus, AuthorizationStatus[]>` in the service and check in `updateAuthorization`.
- [x] `UpsertAuthorizationServiceSchema` — `authorizationId`, `authorizationServiceId?`, + `AuthorizationServiceInputSchema` fields.
- [x] `DeactivateAuthorizationServiceSchema`, `ArchiveAuthorizationSchema`.

### 6.4 Service (`src/lib/services/authorizations.service.ts`)

- [x] Payers: `listPayers(orgId, { includeInactive?, page?, pageSize? })` → `{ rows, rowCount }` with a list-only projection; `upsertPayer(orgId, userId, data)` (direct insert/update).
- [x] Reference: `listAvailableServiceCodeMappings()` — global read of active `service_code_mappings` embedded with `billing_services` (for the "activate service" picker).
- [x] Org services: `listOrgServices(orgId, { includeDisabled?, page?, pageSize? })` → paginated `OrganizationServiceWithMapping` rows with an explicit projection; `activateOrgService(orgId, userId, data)` (direct insert; unique `(organization_id, service_code_mapping_id)` → catch `23505` and throw `'Service already activated'`); `updateOrgService`.
- [x] Authorizations: `listPatientAuthorizations(orgId, patientId, { page?, pageSize? })` → paginated list rows with effective expiry derived in SQL and **without** `encrypted_prior_auth_number`; `getAuthorizationDetail(orgId, patientId, authId)` returns the parent plus bounded service rows and batch-resolved effective rates; `createAuthorization(orgId, userId, data)` → RPC; `updateAuthorization` (transition check → direct update); `archiveAuthorization` (`archived_at`).
- [x] Auth services: `upsertAuthorizationService(orgId, authId, data)` (direct), `deactivateAuthorizationService`.
- [x] `get_effective_organization_service_rates` provides a batched, permissioned fallback-rate lookup for detail pages. `pickEffectiveRate(authService, organizationRate, serviceDate)` applies authorization-first precedence in TypeScript for unit tests and matching-engine reuse.
- [x] `listActiveAuthorizationServicesForPatient(orgId, patientId, onDate)` — used by Phase 7 shift form: active auth services whose parent authorization is `Active` and date-covers `onDate`.

### 6.5 Actions

- [ ] `src/app/(dashboard)/settings/payers/actions.ts` — payer actions (`authorizations.manage`).
- [ ] `src/app/(dashboard)/settings/services/actions.ts` — org service actions (`authorizations.manage`), `listAvailableServiceCodeMappingsAction` (any authenticated org member — check `getOrgMembership`, no permission).
- [ ] `src/app/(dashboard)/patients/actions.ts` — **append** authorization actions here (they live under the patient route): `listPatientAuthorizationsAction`, `getAuthorizationAction`, `createAuthorizationAction`, `updateAuthorizationAction`, `archiveAuthorizationAction`, `upsertAuthorizationServiceAction`, `deactivateAuthorizationServiceAction`, `checkAuthorizationServiceCompatibilityAction`. Raw rates remain inside authorized detail/rate-management read models; do not add a single-rate action. Read perm: `authorizations.manage` (Schedulers get `shifts.manage` read via the policy tweak — reads should accept either: `try requirePermission(authorizations.manage) catch → requirePermission(shifts.manage)`; add helper `requireAnyPermission(orgId, codes[])` to `src/lib/permissions/index.ts`). Revalidate `/patients/${patientId}`.

### 6.6 Pages & components

```
/settings/payers                    PayerList        + /new + /[payerId]/edit          → PayerForm
/settings/services                  OrgServiceList   + /activate (picker from mappings) + /[organizationServiceId]/edit → OrgServiceForm
/patients/[patientId]/authorization                     AuthorizationList  (replaces placeholder; columns payer, dates, status chip, #services, masked auth #)
/patients/[patientId]/authorization/new                 AuthorizationCreate (AuthorizationForm + repeatable AuthorizationServiceRows)
/patients/[patientId]/authorization/[authorizationId]   AuthorizationCore   (summary + bounded AuthorizationServiceList; today's effective rates come from the detail read model, never one action per row)
/patients/[patientId]/authorization/[authorizationId]/edit                              AuthorizationEdit
/patients/[patientId]/authorization/[authorizationId]/service/new                       AuthorizationServiceForm
/patients/[patientId]/authorization/[authorizationId]/service/[authorizationServiceId]/edit
```

- [ ] Nav: under Settings header add `Payers` (`/settings/payers`) and `Services` (`/settings/services`).
- [ ] `PatientCore` gets an "Authorizations" `InfoSection` linking to `/authorization`.

### 6.7 Tests

- [x] Schema tests incl. date refinements, `authorized_quantity > 0`, nested services array.
- [ ] Service: `pickEffectiveRate` table-driven (auth rate in range → authorization; auth rate null → org default; out of range → org default; both null → missing); `ALLOWED_AUTH_TRANSITIONS` — every disallowed transition throws; list select string does not contain `encrypted_prior_auth_number`; `23505` → friendly error.
- [ ] Actions: standard matrix; `requireAnyPermission` unit test in `tests/unit/permissions.test.ts`.
- [ ] Performance contracts: list services apply range/count/order and explicit projections; detail loading uses one authorization read-model request; rendering N services does not issue N effective-rate calls; list reads never invoke an expiry mutation.

### 6.8 Stretch goals

- [ ] Schedule `expire_authorizations` only if a persisted status is required outside application queries.
- [ ] Add `backdate_organization_service_rate(...)` as a separate privileged correction RPC only when a real business workflow requires it. It must require an explicit reason, split/close affected historical ranges atomically, write an operational-history event, and never be exposed by the ordinary rate editor.
- [ ] Add production query-plan monitoring for authorization date-range and organization-scope indexes.

---

## Phase 7 — Shift Module

**Goal:** Schedulers can create, assign, and track shifts. Assignment goes through full revalidation.

### 7.0 Optimization integration

- [ ] `listShifts` returns a URL-paginated page object using an explicit list projection, database-side filters/count, and deterministic `start_datetime, id` ordering.
- [ ] `getShiftDetail` returns the shift and bounded assignment-history/context data in one page-specific read model; compensation and other separately permissioned data stay outside it.
- [ ] The create page loads patient authorization-service options in one bounded query after patient selection; it does not resolve rates or permissions once per option.
- [ ] Assignment, cancellation, and coverage changes remain single transactional RPCs that include assignment history and operational-event writes where part of the same business transition.
- [ ] Reuse request-local auth/membership/permission context across layout and shift pages.

### 7.1 Gaps checklist (schema/types/migration/tests)

- [ ] **Migration `00017_shift_rpcs.sql`:** `create_shift(...)` (validates auth service active + date-covers shift, patient in org, `end > start`; status Open) · `confirm_shift_assignment(target_org_id, target_shift_id, target_caregiver_id, expected_version int, override_reason text default null)` (re-checks: caregiver Active/matching Active, eligibility for the org service, required credential not expired, no overlapping shift for caregiver; `version` check → raise on mismatch; sets `assigned_caregiver_id, status='Assigned', coverage_status='Assigned', assignment_confirmed_*`, `version+1`; inserts `shift_assignment_history` (`Assigned`/`Reassigned`)) · `cancel_shift(...)` (history `Cancelled`) · `set_shift_coverage(target_org_id, target_shift_id, new_status, new_coverage_status, change_type, reason_code)` (used by Phase 9; history row) · `record_operational_event(target_org_id, action_type, resource_type, resource_id, status, related_patient_id, related_caregiver_id, related_shift_id, related_call_off_id, summary_code, metadata jsonb)` (only INSERT path for `operational_history_events`; **this replaces Phase 12.1** — the TS service becomes a thin wrapper). Register all in `Database.Functions`.
- [ ] **Types:** `SHIFT_STATUSES`, `SHIFT_COVERAGE_STATUSES`, `VISIT_TYPES = ['Scheduled','PRN','Assessment','Supervisory'] as const` (SQL `visit_type` is free text); `ShiftWithContext = Shift & { patient: Pick<Patient,'id'|'first_name'|'last_name'>; caregiver: Pick<Caregiver,'id'|'first_name'|'last_name'|'classification'> | null; authorization_service: Pick<AuthorizationService,'id'|'organization_service_id'> & { organization_service: Pick<OrganizationService,'local_service_name'> } }`; `ShiftFilters = { status?, from?, to?, patientId?, caregiverId? }`.
- [ ] **Schemas** (`shifts.schema.ts`): `CreateShiftSchema` (`patientId, authorization_service_id, start_datetime, end_datetime (ISO), visit_type`; refine end > start, duration ≤ 24h) · `UpdateShiftSchema` (times/visit_type only; refine ≥1) · `AssignShiftSchema` (`shiftId, caregiverId, expectedVersion, overrideReason?`) · `CancelShiftSchema` (`shiftId, reason_code`) · `ShiftFiltersSchema`.
- [ ] **Service extras:** pure `findScheduleConflicts(candidateShifts, start, end)` and `isWithinAvailability(windows, start, end)` (no Supabase; reused by Phase 8). `listShifts` selects an explicit `ShiftWithContext` list projection and returns `{ rows, rowCount }`; `listShiftsForCaregiver(orgId, caregiverId, from, to, { page?, pageSize? })` is bounded and paginated.
- [ ] **Routes:** `/shifts` (ShiftList: status tabs, date range, patient/caregiver filter) · `/shifts/create` (patient Select → auth-service Select via `listActiveAuthorizationServicesForPatient`) · `/shifts/[shiftId]` (ShiftCore: summary, assignment history list, "Assign" → caregiver Select **until Phase 8 replaces it with matching**, Cancel via `dialogs.confirm`) · `/shifts/[shiftId]/edit`. Nav "Shifts". Also `/patients/[patientId]/shift` list section link from PatientCore and `/caregivers/[caregiverId]/shift`.
- [ ] **Tests:** schema (24h, ordering); service pure fns (overlap/adjacent/none; availability inside/outside effective range); list projection/range/count/order; bounded detail read model; RPC arg mapping incl. `expected_version`; actions matrix; `confirmAssignmentAction` maps RPC `'Shift was modified'` error to `success:false`.

### 7.2 Shift service

- [ ] Create `src/lib/services/shifts.service.ts`:
  - `listShifts(orgId, filters?)` — URL-backed pagination plus database-side status, date range, patient, and caregiver filters
  - `getShiftDetail(orgId, shiftId)` — explicit parent/context projection with bounded assignment history
  - `createShift(orgId, userId, data)` — validate patient, auth service, org ownership; create as Open or Assigned
  - `updateShift(orgId, shiftId, userId, data)` — non-assignment updates
  - `confirmAssignment(orgId, shiftId, caregiverId, userId)` — one RPC with **full revalidation inside transaction**: authorization valid, caregiver eligible, no schedule conflict, no double-booking (use `version` field for optimistic concurrency); insert `shift_assignment_history`; record the operational event in the same transaction
  - `cancelShift(orgId, shiftId, userId)` — one RPC sets status = Cancelled and writes assignment/operational history atomically
  - `markReplacementNeeded(orgId, shiftId)` — called by call-off service
  - `markCovered(orgId, shiftId, caregiverId)` — called on replacement confirmation
  - `markUncovered(orgId, shiftId)` — called on unresolved call-off

### 7.3 Shift schemas

- [ ] Create `src/lib/schemas/shifts.schema.ts`:
  - `CreateShiftSchema` — patient_id, authorization_service_id, start_datetime, end_datetime, visit_type
  - `AssignShiftSchema` — caregiver_id
  - `ShiftListResponseSchema` — minimal patient identifiers in list view

### 7.4 Shifts list page (MUI template)

- [ ] Wire template into `src/app/shifts/page.tsx`
  - Template `data/` → Server Action → `shifts.service.listShifts()`
  - Status filter tabs: Open | Assigned | Replacement Needed | Uncovered
  - Date range picker
  - "Create Shift" button → form drawer
  - "Run Matching" link on unassigned rows → navigates to shift detail
  - Permission guard: `shifts.manage`

### 7.5 Shift detail page (MUI template)

- [ ] Wire template into `src/app/shifts/[shiftId]/page.tsx`
  - Shift summary (patient ID, service, time, status)
  - Matching results table (`matching-results-table.tsx`) — shown when matching run exists
  - "Run Matching" button → Server Action → `matching.service.runMatching()`
  - Candidate rows: Recommended / Review Required / Excluded with score badges
  - Assign button on each Recommended candidate → Server Action → `shifts.service.confirmAssignment()`
  - Manual override form for Review Required candidates → reason + confirm

### 7.6 Stretch goals

- [ ] Add scheduled reconciliation for stale open shifts only if workflow reporting requires persisted derived status.
- [ ] Add production tracing for assignment RPC contention and optimistic-concurrency failures.

---

## Phase 8 — Matching Engine

**Goal:** Matching service produces scored, ranked candidates using the exact scoring formula.

### 8.0 Optimization integration

- [ ] Load matching inputs through a bounded, organization-scoped read model rather than one query per caregiver or rule component.
- [ ] Batch travel-cache lookups before provider calls and deduplicate identical origin/destination requests within one matching run.
- [ ] Persist the run and all candidates in one authenticated transactional RPC; do not use the service-role client for this ordinary user-triggered workflow.
- [ ] Paginate persisted candidate results and use explicit projections that exclude compensation, raw addresses, restricted notes, and unused scoring context.
- [ ] Treat expired matching runs as expired in read queries; do not run an expiry mutation when a user opens a matching page.

### 8.1 Gaps checklist

- [ ] **Distance provider:** Amazon Location Service (exact API — Routes `CalculateRoute` vs. the newer `amazon-location-routes` — **TBD**). Implement `distance.service.ts` behind `TravelProvider { getTravel(originHash, destHash, coords): Promise<TravelResult> }` with two implementations: `AmazonLocationProvider` (reads `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_LOCATION_ROUTE_CALCULATOR_NAME`; `@aws-sdk/client-location`) and `HaversineProvider` (straight-line km × 1.3 ÷ 40 km/h → minutes) used when AWS env vars are absent and in unit tests. Selection in one place: `getTravelProvider()`. Cache via `upsert_travel_cache` RPC.
- [ ] **Migration `00019_matching_rpcs.sql`:** `persist_matching_run(target_org_id, target_shift_id, target_call_off_id uuid, ruleset_version text, candidates jsonb) returns matching_runs` (checks `matching.run`, inserts run as Completed + all candidate rows in one tx; excludes `call_offs.original_caregiver_id` when `call_off_id` given; `unique` guard on `(matching_run_id, caregiver_id)` in-loop) · `upsert_travel_cache(...)` (narrow authenticated RPC with organization validation; no service-role client) · candidate-list read support with effective expiry (`expires_at < now()`). `matching_candidates.score` is `numeric(6,4)` → store 0–100 with 4dp.
- [ ] **Types:** `MatchingRulesetConfig` (from §3.2 JSON), `ScoreComponents = { qualification, availability, travel, preference, schedule }`, `ExplanationCode` union (`'MISSING_CREDENTIAL' | 'NO_AVAILABILITY_OVERLAP' | 'SCHEDULE_CONFLICT' | 'TRAVEL_EXCEEDS_MAX' | 'NOT_ELIGIBLE_FOR_SERVICE' | 'RESTRICTION_CONFLICT' | 'TRAVEL_ESTIMATE_UNAVAILABLE' | 'RATE_MISSING' | …`), `CandidateEvaluation` (pre-persist shape), `MatchingRunWithCandidates`, `MatchingCandidateWithCaregiver`.
- [ ] **Schemas:** `RunMatchingSchema` (`shiftId, callOffId?`), `AssignFromMatchingSchema` (`matchingRunId, caregiverId, expectedVersion, overrideReason?` — required non-empty when candidate is Review Required; enforced in action after loading the candidate).
- [ ] **Service structure:** `matching.service.ts` exports **pure** `evaluateCandidate(ctx, caregiver, ruleset): CandidateEvaluation`, `applyHardExclusions`, `scoreQualification/Availability/Travel/Preference/Schedule`, `rankCandidates`, and the orchestrator `runMatching(orgId, userId, { shiftId, callOffId })` which loads data via other services, maps, calls `persist_matching_run`, then `record_operational_event('matching.run_completed', …)`. Pure fns take plain objects → fully unit-testable without mocks.
- [ ] **Routes/components:** `/shifts/[shiftId]/matching` (MatchingResults: "Run matching" button → `runMatchingAction`; DataGrid of candidates grouped by status chip; Excluded collapsed; Assign action → `assignFromMatchingAction`; ManualOverrideDialog via `dialogs` for Review Required) · `/patients/[patientId]/matching` placeholder → link list of the patient's open shifts. `shifts/[shiftId]` "Assign" button now routes here.
- [ ] **Tests (bulk of phase):** `tests/unit/services/matching.scoring.test.ts` — each component score with fixtures; final formula rounding/clamp; 14 hard-exclusion scenarios each → Excluded with the right code; missing-data table (§8.3) → correct status + neutral score; thresholds 80/60; tie-break order. `matching.actions.test.ts` — override reason required for Review Required; original caregiver never in results (mock RPC args include `call_off_id`).

### 8.2 Distance service

- [ ] Create `src/lib/services/distance.service.ts`:
  - `getTravelResults(orgId, requests[])` — batch/deduplicate cache lookups, then call the provider only for unique misses
  - `fetchFromProvider(originHash, destHash)` — call Amazon Location Service Routes API (`CalculateRoute`) with synthetic location data
  - `buildLocationHash(addressLine, city, state, zip)` — deterministic hash, never store raw address
  - Cache TTL: 24 hours for same-day/next-day shifts; 7 days for future shifts
  - On provider unavailable: return cached result or `{ status: 'review_required', reason: 'travel_estimate_unavailable', travelScore: 70 }`

### 8.3 Matching service

- [ ] Create `src/lib/services/matching.service.ts`:

  **Input:** `{ shiftId, organizationId, callOffId? }` — identifiers only, no form data

  **Orchestration:**
  1. Load shift, patient, authorization service, and required patient requirements in one scoped matching-context query
  2. Load eligible active caregivers with only required eligibility, credential, availability, constraint, skill, and schedule fields in a bounded/batched query; never issue one query per caregiver
  3. Apply hard exclusion rules (inactive caregiver, missing credential, no availability overlap, expired auth, service not covered, restriction conflict, travel > 45 min, schedule conflict)
  4. For remaining candidates, compute component scores:
     - `qualificationScore` — credentials/skills vs requirements
     - `availabilityScore` — overlap minutes / shift minutes × 100
     - `travelScore` — via `distance.service.getTravelResult()`
     - `preferenceScore` — matched patient preferences
     - `scheduleScore` — workload and back-to-back checks
  5. `finalScore = qualification*0.40 + availability*0.25 + travel*0.20 + preference*0.10 + schedule*0.05`
  6. Clamp to 0–100, round to integer
  7. Assign recommendation status (Recommended ≥ 80 + component thresholds; Review Required 60–79 or flags; Excluded < 60 or hard exclusion)
  8. Sort: Recommended → Review Required → Excluded; within tier apply tie-breaking rules
  9. Call the authenticated `persist_matching_run` RPC to insert `matching_runs`, `matching_candidates`, and the operational event atomically
  10. Do not invoke the service-role client for this user-triggered workflow
  11. Return run ID + candidate summary counts

  **Hard exclusion list** (from system architecture):
  - Inactive caregiver, failed background check, missing required credential, expired license
  - Unauthorized service eligibility, inactive/expired authorization, service not covered by auth
  - No availability overlap, direct schedule conflict, patient/caregiver restriction conflict
  - Required clinical competency missing, travel > 45 min, blocking rate rule fails

  **Missing data behavior:**
  - Missing authorization data → Excluded
  - Missing credential data → Excluded
  - Missing caregiver availability → Excluded
  - Missing location → Review Required, travel score = 70
  - Missing optional preference → neutral score = 70
  - Missing rate data → Review Required
  - Missing schedule history → neutral schedule score = 80

### 8.4 Matching schemas

- [ ] Create `src/lib/schemas/matching.schema.ts`:
  - `RunMatchingInputSchema` — `{ shiftId: uuid, organizationId: uuid, callOffId?: uuid }`
  - `CandidateResponseSchema` — score, status, explanation_codes (no PHI, no raw compensation)
  - `AssignCandidateSchema` — `{ matchingRunId, caregiverId, overrideReason? }`

### 8.5 Matching components

- [ ] `src/components/tables/matching-results-table.tsx`
  - Columns: Caregiver name, classification, score badge, availability %, travel time, status chip, action button
  - Status chip: green = Recommended, amber = Review Required, red = Excluded
  - Excluded rows collapsed by default with expand toggle
  - Compensation values never shown in this table
- [ ] `src/components/forms/manual-override-form.tsx`
  - Override reason (required text), confirmation checkbox
  - Only shown for Review Required candidates
  - Submits to `shifts.service.confirmAssignment()` with override context

### 8.6 Stretch goals

- [ ] Schedule `expire_matching_runs` only if persisted expiry is required for external reporting; normal queries derive expiry from `expires_at`.
- [ ] Move large matching runs to a background queue only after measured request-duration or concurrency limits justify the added infrastructure.
- [ ] Add provider-level travel latency/cost dashboards and adaptive concurrency limits.

---

## Phase 9 — Call-Off Module

**Goal:** Schedulers can report call-offs, find replacement candidates, track outreach, and resolve or mark coverage unresolved.

### 9.0 Optimization integration

- [ ] `listCallOffs` uses URL-backed pagination, explicit queue projections, database-side queue filters/counts, and deterministic urgency ordering.
- [ ] `getCallOffDetail` returns the call-off summary plus bounded candidate and outreach previews in one page-specific read model; full histories use dedicated paginated routes when needed.
- [ ] Reporting, confirming a replacement, recording outreach state, and marking unresolved remain transactional RPCs for all database state changes and history events.
- [ ] Starting matching after report may be a second orchestrated operation, but retries must be idempotent and must not create duplicate active call-offs or matching runs.
- [ ] Reuse request-local auth/membership/permission context and avoid one permission or data request per candidate row.

### 9.1 Gaps checklist

- [ ] **Migration `00020_call_off_rpcs.sql`:** `create unique index call_offs_one_active_per_shift on call_offs(organization_id, shift_id) where status not in ('Resolved','Unresolved','Cancelled')` · `report_call_off(target_org_id, target_shift_id, reason_code, report_source, restricted_reason_note_id default null) returns call_offs` (validates shift Assigned & future/in-progress, sets shift `status='Replacement Needed', coverage_status='Call-Off Reported'`, history `Call-Off`, `original_caregiver_id` from shift, clears `assigned_caregiver_id`? **No** — keep it until replacement so UI shows who called off; matching excludes via `call_off_id`) · `confirm_replacement(target_org_id, target_call_off_id, target_caregiver_id, expected_shift_version int) returns call_offs` (revalidates via same checks as `confirm_shift_assignment`; shift → `Covered`/`Covered`; history `Replacement` with previous = original; call-off → Resolved, `replacement_caregiver_id, resolved_by, resolved_at, resolution_type='Covered'`; selected candidate `response_status='Selected', selected_at/by`; others Pending/Interested → `Withdrawn`; idempotent if already resolved with same caregiver) · `mark_call_off_unresolved(target_org_id, target_call_off_id, resolution_type)` (shift → `Uncovered`/`Uncovered`; history `Cancelled`? no — `change_type='Call-Off'` with `reason_code='unresolved'`) · `record_call_off_outreach(target_org_id, target_call_off_id, target_caregiver_id, matching_candidate_id, contact_method, outreach_status, response_status)` (inserts append-only event **and** updates `matching_candidates.outreach_status/response_status/contacted_at/responded_at`, advances call-off status Reported→Outreach In Progress, Accepted→Pending Confirmation). Register all.
- [ ] **Types:** `CALL_OFF_STATUSES`, `CALL_OFF_REASON_CODES`, `CALL_OFF_REPORT_SOURCES`, `CALL_OFF_RESOLUTION_TYPES`, `OUTREACH_EVENT_STATUSES`, `OUTREACH_CONTACT_METHODS = ['Phone','Text','Email','Other']` (fixes drift in `CallOffOutreachEvent.contact_method`); `CallOffQueue = 'active' | 'resolved' | 'unresolved'`; `CallOffWithContext = CallOff & { shift: Pick<Shift,'id'|'start_datetime'|'end_datetime'|'status'>; original_caregiver: Pick<Caregiver,'first_name'|'last_name'>; replacement_caregiver: … | null; latest_run_id: string | null }`; `CallOffDetail = CallOffWithContext & { candidates: MatchingCandidateWithCaregiver[]; outreach_events: CallOffOutreachEvent[] }`; `CallOffUrgency = 'Critical' (<4h) | 'High' (<24h) | 'Normal'` + pure `getCallOffUrgency(shiftStart, now)`.
- [ ] **Schemas** (`call-offs.schema.ts`): `ReportCallOffSchema` (`shiftId, reason_code, report_source, restricted_reason_note_id?`) · `RecordOutreachSchema` (`callOffId, caregiverId, matchingCandidateId?, contact_method, outreach_status, response_status`) · `ConfirmReplacementSchema` (`callOffId, caregiverId, expectedShiftVersion`) · `MarkUnresolvedSchema` (`callOffId, resolution_type` ∈ Missed/Delayed/Shortened/Cancelled/Other) · `CallOffFiltersSchema` (`queue`).
- [ ] **Service:** `reportCallOff` = RPC → `matching.service.runMatching({shiftId, callOffId})` → status update to `Candidates Available` (≥1 non-Excluded) or `Replacement Needed` (0) → `record_operational_event`. Queue mapping: active = `Reported, Replacement Needed, Candidates Available, Outreach In Progress, Pending Confirmation`; sort active by `shift.start_datetime asc`. `notifications.service.send` calls are **stubbed** (`console.info`) until Phase 10 — put the call sites in now behind `notifyStub()`.
- [ ] **Routes/components:** `/call-offs` (CallOffList: 3 queue tabs, urgency chip, columns shift time/original caregiver/status/candidates count) · `/call-offs/report` (ReportCallOffForm: Select of Assigned shifts from `listShiftsAction({status:'Assigned', from: now})`) · `/call-offs/[callOffId]` (CallOffCore: summary · ReplacementCandidatesList = matching DataGrid + outreach/response columns, Declined greyed, "Record outreach" row action → OutreachDialog (uses `dialogs`), "Confirm" row action → `confirmReplacementAction` · "Mark unresolved" → UnresolvedDialog). Nav "Call-offs"; `/call-offs` already protected. `shifts/[shiftId]` gets "Report call-off" button when Assigned.
- [ ] **Tests:** schema; service — queue classification table, `getCallOffUrgency` boundaries, list projection/range/count/order, bounded detail model, `reportCallOff` status choice by candidate count, RPC arg mapping for all four; actions matrix; `confirmReplacementAction` surfaces version-conflict error; retries do not duplicate active call-offs/runs.

### 9.2 Call-off service

- [ ] Create `src/lib/services/callOffs.service.ts`:

  **`reportCallOff(orgId, userId, data)`**
  - Accepts: shift_id, reason_code, report_source, optional restricted_reason_note_id
  - Validates: shift exists in org, shift is active + assigned, not completed/cancelled, no active call-off already exists
  - In one transaction:
    1. Create `call_offs` row (status = Reported)
    2. Call `shifts.service.markReplacementNeeded()`
    3. Call `matching.service.runMatching({ shiftId, callOffId })`
    4. Update call-off status to Candidates Available or Replacement Needed based on matching results
    5. Write `operational_history_events`
  - Returns call-off ID + candidate count

  **`recordOutreach(orgId, callOffId, userId, data)`**
  - Accepts: caregiver_id, contact_method, outreach_status, response_status
  - Insert `call_off_outreach_events` row (append-only)
  - Update `matching_candidates.outreach_status` / `response_status`
  - Trigger `notifications.service.send()` for outreach notification
  - Write `operational_history_events`

  **`confirmReplacement(orgId, callOffId, caregiverId, userId)`**
  - In one transaction:
    1. Revalidate all blocking rules (matching service hard exclusions re-run)
    2. If validation fails: throw safe error, block confirmation
    3. Call `shifts.service.markCovered(shiftId, caregiverId)` → also writes `shift_assignment_history`
    4. Update call-off status = Resolved, replacement_caregiver_id
    5. Mark selected candidate as Selected
    6. Update other candidates' response_status = Withdrawn
    7. Send confirmation notification via `notifications.service`
    8. Write `operational_history_events`
  - Idempotent by (call_off_id, replacement_caregiver_id)

  **`markUnresolved(orgId, callOffId, userId, data)`**
  - Accepts: resolution_type, optional notes
  - Call `shifts.service.markUncovered(shiftId)`
  - Update call-off status = Unresolved, resolution_type
  - Write `operational_history_events`

  **`listCallOffs(orgId, filters?)`** — paginated active, resolved, and unresolved queues with database-side classification

  **`getCallOffDetail(orgId, callOffId)`** — explicit call-off projection with bounded candidates and outreach-event previews

### 9.3 Call-off schemas

- [ ] Create `src/lib/schemas/call-offs.schema.ts`:
  - `ReportCallOffSchema` — shift_id, reason_code, report_source
  - `RecordOutreachSchema` — caregiver_id, contact_method, outreach_status, response_status
  - `ConfirmReplacementSchema` — call_off_id, caregiver_id
  - `MarkUnresolvedSchema` — resolution_type

### 9.4 Call-offs list page (MUI template)

- [ ] Wire template into `src/app/call-offs/page.tsx`
  - Three tab queues: Active | Resolved | Unresolved
  - Active queue sorted by shift start time (most urgent first)
  - Status chips per call-off status
  - "Report Call-Off" button → `report-call-off-form.tsx` modal

### 9.5 Call-off detail page (MUI template)

- [ ] Wire template into `src/app/call-offs/[callOffId]/page.tsx`
  - Call-off summary (shift, caregiver, reason, report time)
  - Replacement candidates table (`replacement-candidates-table.tsx`) — same component as matching results
  - Outreach panel — list of outreach events + "Record Outreach" button → `outreach-record-form.tsx`
  - Confirm replacement button → `shifts.service.confirmAssignment()` via call-off service
  - "Mark Unresolved" button → `unresolved-coverage-form.tsx`

### 9.6 Replacement candidates table

- [ ] `src/components/tables/replacement-candidates-table.tsx`
  - Reuse matching results table structure
  - Original caregiver excluded from results (enforced in matching service)
  - Outreach status column added (Not Contacted / Contacted / Notification Sent)
  - Response status column (Pending / Interested / Accepted / Declined)
  - Declined candidates shown greyed out, not selectable

### 9.7 Stretch goals

- [ ] Move matching/notification orchestration to a durable background queue only when measured latency or delivery guarantees require it.
- [ ] Add scheduled reconciliation for stuck call-offs and incomplete workflow transitions.

---

## Phase 10 — Notifications

**Goal:** Controlled template-based notifications are sent without including PHI in outreach content.

### 10.0 Optimization integration

- [ ] Add one transactional `enqueue_notification` RPC that validates the template key/allowed variables, enforces the idempotency key, and inserts or returns the existing notification atomically.
- [ ] Back idempotency with a unique database constraint; do not implement check-then-insert as two API calls.
- [ ] Use explicit notification list projections and server pagination for any delivery-history UI.
- [ ] Reuse request-local auth/org context for administrative notification pages and keep provider secrets server-only.

### 10.1 Notification service

- [ ] Create `src/lib/services/notifications.service.ts`:
  - `send(orgId, templateKey, recipientUserId?, recipientCaregiverId?, variables)` — provider-agnostic
  - Validate template exists and is active
  - Validate `variables` keys against template `allowed_variables`
  - Validate variable values do not contain disallowed fields (no patient names, exact addresses, auth numbers, diagnoses)
  - Generate `idempotency_key` = hash of (template_key + recipient + shift/call-off ID)
  - Call `enqueue_notification` once; its unique constraint returns the existing notification for a duplicate idempotency key
  - Call configured provider (stub/log in MVP; replace with real provider before go-live)
  - Update delivery_status = Sent/Delivered/Failed
  - Provider errors: retry-safe; update failure reason code

### 10.2 Provider stub

- [ ] MVP: log notification to console / `operational_history_events` — do not call a real provider until a BAA-capable provider is selected
- [ ] Provider interface is abstracted so swapping providers requires only one file change

### 10.3 Stretch goals

- [ ] Add a durable background delivery queue, scheduled retries with backoff, dead-letter handling, and provider delivery webhooks when a production provider is selected.
- [ ] Add delivery-volume, failure-rate, and provider-cost monitoring.

---

## Phase 11 — Dashboard

**Goal:** Role-filtered operational dashboard with action queues and key metrics.

### 11.0 Optimization integration

- [ ] Build one role-aware dashboard read model/RPC per dashboard variant rather than one Supabase request per metric card.
- [ ] Return aggregate counts and bounded queue projections only; never load full domain tables to calculate metrics in TypeScript.
- [ ] Keep compensation/authorization aggregates in a separately permissioned query when the role lacks either permission.
- [ ] Reuse request-local auth/org/permission context and stream only genuinely independent dashboard sections.
- [ ] Avoid client-side refetch of the initial server payload; add explicit refresh behavior only where operational freshness requires it.

### 11.1 Dashboard service

- [ ] Create `src/lib/services/dashboard.service.ts`:
  - `getSchedulerDashboard(orgId, userId)`:
    - Open shifts count
    - Shifts by date (next 7 days)
    - Active call-offs with status breakdown
    - Replacement candidates pending confirmation
    - Uncovered shifts count
  - `getAdminDashboard(orgId, userId)`:
    - All scheduler metrics
    - Call-off resolution rate (resolved / total in last 30 days)
    - Uncovered shift trend
    - Financial summary only if user has `caregivers.read_compensation` / `authorizations.manage`
  - `getClinicalDashboard(orgId, userId)`:
    - Shifts requiring clinical approval
    - Caregivers with expiring/expired credentials (within 30 days)
    - Patients with Clinical/Restricted requirements active
  - `getHRDashboard(orgId, userId)`:
    - Caregivers with incomplete credentials
    - Caregivers with no availability set
    - Active caregivers count by classification

  All methods: reuse the server-resolved request context, verify required permissions in the database read model, and never return raw patient names or compensation values.

### 11.2 Dashboard page (MUI template)

- [ ] Wire template into `src/app/dashboard/page.tsx`
  - Load dashboard data via Server Action based on current user's role
  - Template metric cards → wired to dashboard service response
  - Template queue/list components → action lists for open shifts, active call-offs
  - Navigation from dashboard cards → shift, call-off, caregiver, patient detail pages
  - No client-side data fetching for initial load — use Server Component + streaming

### 11.3 Stretch goals

- [ ] Add short-lived aggregate caching only after defining per-organization invalidation and confirming that slightly stale metrics are acceptable.
- [ ] Add materialized summaries or scheduled refresh jobs only when measured dashboard query cost requires them.

---

## Phase 12 — Operational History

> **Superseded by `record_operational_event` RPC (Phase 7.1).** `operational-history.service.ts` is a thin wrapper `record(...)` → RPC; `listEvents` reads the table. Keep §12.2 integration points as the checklist of call sites.

**Goal:** Workflow events are recorded for dashboard metrics and troubleshooting without storing PHI.

### 12.0 Optimization integration

- [ ] Business-transition RPCs write their operational event in the same transaction; do not make a second API call after a successful mutation when atomic event recording is required.
- [ ] Keep `record_operational_event` for standalone events that are not part of another transactional mutation.
- [ ] `listEvents` uses an explicit projection, organization/time filters, deterministic ordering, and cursor or server pagination.
- [ ] Add indexes only for measured organization/time/resource query patterns.

### 12.1 Operational history service

- [ ] Create `src/lib/services/operational-history.service.ts`:
  - `record(orgId, actorUserId?, actionType, resourceType, resourceId, status, relatedIds?, metadata?)` — thin wrapper over the authenticated RPC for standalone events
  - Enforced fields: no patient names, exact addresses, auth numbers, diagnoses, compensation values
  - Called by: Patient Service, Caregiver Service, Shift Service, Matching Service, Call-Off Service, Notification Service
  - `listEvents(orgId, filters?)` — paginated explicit projection for dashboard history

### 12.2 Integration points

- [ ] Patient create/update → record `patient.created` / `patient.updated`
- [ ] Caregiver status change → record `caregiver.status_changed`
- [ ] Organization-service rate change → write an operational-history event in the same rate-change transaction; include service/rate-version identifiers, effective date, and change reason, but never the monetary amount
- [ ] Shift assignment → record `shift.assigned`
- [ ] Shift call-off → record `shift.call_off_reported`
- [ ] Matching run → record `matching.run_completed` (include candidate counts, no PHI)
- [ ] Replacement confirmed → record `call_off.resolved`
- [ ] Replacement unresolved → record `call_off.unresolved`
- [ ] Notification sent/failed → record `notification.sent` / `notification.failed`

### 12.3 Stretch goals

- [ ] Archive or partition old operational events only after retention requirements and measured table growth justify it.
- [ ] Export audit events to an external analytics system only after privacy, BAA, and data-retention review.

---

## Phase 13 — Server Action Conventions

Apply these rules consistently across all Server Actions before finalizing any module.

### 13.0 Optimization integration

- [ ] Server pages use the shared request-local authorized organization context and call read services directly after authorization.
- [ ] Client-triggered reads and all mutations continue to use Server Actions because they cross a trust boundary.
- [ ] `requireAuth`, active-membership resolution, and identical permission checks are request-memoized without cross-request caching.
- [ ] Actions never loop over rows and call a service once per row; add a batch service/RPC instead.
- [ ] Multi-step mutations call one transactional service/RPC and revalidate only affected paths.
- [ ] Validation occurs before permission lookup when the organization ID is part of validated action input; page organization context remains server-derived.

### Every Server Action must:

```typescript
'use server'

export async function exampleAction(input: unknown) {
  // 1. Authenticate
  const session = await requireAuth()

  // 2. Validate input with Zod (.strict() — reject unknown fields)
  const parsed = ExampleInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  // 3. Verify org membership + permission
  await requirePermission(parsed.data.organizationId, 'relevant.permission')

  // 4. Call service (never call Supabase directly from action)
  try {
    const result = await exampleService.doThing(parsed.data)
    return { success: true, data: result }
  } catch (err) {
    // 5. Return safe error — never expose internal details
    return { success: false, error: 'Unable to complete this action.' }
  }
}
```

### Response shape (all actions):

```typescript
type ActionResponse<T> = {
  success: boolean
  data?: T
  error?: string           // user-safe message only
  fieldErrors?: Record<string, string[]>
  requestId?: string
}
```

### Authorization failure rule:
Return `{ success: false, error: 'Not authorized.' }` — never indicate whether the record exists.

### Request-efficiency rule:

One action invocation should normally produce one request-local auth/permission context and one service operation. Additional Supabase calls require a data dependency or a deliberately separate sensitive permission boundary.

---

## Phase 14 — Testing

### Optimization and request-budget tests

- [ ] Request-local auth test: layout and page share one user and active-membership resolution per render.
- [ ] Permission memoization test: identical organization/permission checks share one result; different permission codes do not.
- [ ] List contract tests: explicit projection, organization filter, database range/count, and deterministic order.
- [ ] Detail contract tests: parent-first behavior, bounded child previews, and no per-row Supabase calls.
- [ ] Mutation contract tests: transactional RPC mapping, rollback behavior, uniqueness/limit enforcement, and retry idempotency.
- [ ] Interactive list reads never invoke expiry or maintenance RPCs.
- [ ] Service-role client is absent from ordinary user-triggered domain services.
- [ ] Record and enforce representative route budgets for Auth, REST/RPC calls, and response size without weakening authorization to meet a number.

### Unit tests (`tests/unit/`)

- [ ] Matching scoring formula — each component score calculation
- [ ] Hard exclusion rules — all 14 scenarios
- [ ] Review Required rules — all scenarios
- [ ] Tie-breaking logic
- [ ] Rate resolution (auth service rate → org service default fallback)
- [ ] Permission checking — role defaults + explicit grants + expired/revoked grants
- [ ] Zod schema validation — all schemas, including `.strict()` rejection of unknown fields
- [ ] Travel score calculation (preferred/max thresholds, missing location fallback)

### Integration tests (`tests/integration/`)

- [ ] Patient create → retrieve → update → archive flow
- [ ] Caregiver create → credential add → availability set → service eligibility flow
- [ ] Authorization create → service link → effective rate resolution
- [ ] Shift create → matching run → assignment confirmation (full transaction test)
- [ ] Call-off report → replacement matching → outreach record → replacement confirm
- [ ] Call-off report → mark unresolved
- [ ] Dashboard metrics queries (org-scoped, role-filtered)
- [ ] **Authorization isolation tests**: user from org A cannot read org B's patients, caregivers, shifts, or call-offs
- [ ] Compensation field hidden for Scheduler and Clinical Manager
- [ ] Clinical/Restricted patient requirements hidden from Scheduler and HR Coordinator
- [ ] Duplicate call-off rejected
- [ ] Double-booking prevention (concurrent assignment attempt)
- [ ] Suspended/revoked membership and changed permissions take effect on the next request (no stale cross-request authorization cache)
- [ ] Authorization and matching expiry are derived correctly without an interactive maintenance write
- [ ] Notification enqueue is idempotent under concurrent duplicate requests

### E2E tests (`tests/e2e/`)

- [ ] Scheduler workflow: login → dashboard → create shift → run matching → confirm assignment
- [ ] Scheduler call-off workflow: report call-off → view replacement candidates → record outreach → confirm replacement
- [ ] Agency Administrator: invite user → assign role → view settings
- [ ] Unresolved coverage: report call-off → no candidates → mark unresolved

### Test data rules:
- All test fixtures must use synthetic, de-identified data
- No real patient names, addresses, DOBs, or identifiers in any test file
- Seed via `supabase/seed/` — never copy from production

---

## Phase 15 — Environment and Deployment

### 15.0 Optimization and cost controls

- [ ] Capture a production-like baseline for Auth calls, REST/RPC calls, database time, response bytes, and render duration on representative list/detail/mutation routes.
- [ ] Verify expensive dynamic routes are not speculatively executed by unnecessary prefetch; change prefetch per-link only after measurement.
- [ ] Review RLS-heavy query plans with representative tenant sizes and add only measured organization/filter/order indexes.
- [ ] Configure Supabase/Vercel/AWS budget alerts and monitor database compute, egress, function duration, and travel-provider usage.
- [ ] Verify no deployment enables cross-request caching of user, membership, or permission results.

### Environment variables (never in source control)

| Variable | Used in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client only | Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Never in browser |
| `AWS_REGION` | Server only | Amazon Location Service region |
| `AWS_ACCESS_KEY_ID` | Server only | Distance service only |
| `AWS_SECRET_ACCESS_KEY` | Server only | Distance service only |
| `AWS_LOCATION_ROUTE_CALCULATOR_NAME` | Server only | Distance service only |
| `NOTIFICATION_PROVIDER_KEY` | Server only | When provider selected |

### Deployment checklist (per environment)

- [ ] Migrations applied before app deploy
- [ ] Seed data verified (billing_services, EVV mappings, rulesets, templates)
- [ ] RLS policies active — verified with `anon` role returning empty results
- [ ] `service_role` key confirmed server-only
- [ ] Preview deployment uses synthetic data only
- [ ] Production deployment: no PHI until full HIPAA readiness checklist complete

### Rollback strategy

- App code: Vercel deployment rollback
- DB: forward-fix migration (do not auto-rollback schema changes)
- If rollback required: write a new migration that reverses the change safely

### 15.1 Stretch goals

- [ ] Schedule authorization/matching expiry persistence only if external consumers require stored status.
- [ ] Add background queues for notification delivery or long matching runs only after synchronous limits are measured.
- [ ] Add automated slow-query capture, request-budget regression dashboards, and long-term operational-history archival.

---

## Implementation Order Summary

| Phase | Module | Depends On |
|---|---|---|
| 1 | Foundation (auth, Supabase, permissions) | — |
| 2 | User management | Phase 1 |
| 3 | Reference data seed | Phase 1 |
| 4 | Patient module | Phase 1–2 |
| 5 | Caregiver module | Phase 1–2 |
| 6 | Authorization module | Phase 4–5 |
| 7 | Shift module | Phase 4–6 |
| 8 | Matching engine | Phase 5–7 |
| 9 | Call-off module | Phase 7–8 |
| 10 | Notifications | Phase 9 |
| 11 | Dashboard | Phase 4–10 |
| 12 | Operational history | Integrated across 4–11 |
| 13 | Server Action conventions | Applied per phase |
| 14 | Testing | Per phase + full suite |
| 15 | Environments + deployment | Final |

---

## Key Rules (carry across all phases)

1. **Business logic belongs in services** — not in page components or Server Actions.
2. **Organization context comes from authenticated membership** — never from browser input.
3. **Every Server Action validates with Zod, checks auth, checks permission** — in that order.
4. **Sensitive fields are hidden at the service layer** — not just the UI layer.
5. **Assignment and replacement confirmation are transactions** — all-or-nothing.
6. **Matching results are recommendations only** — final assignment always re-runs validation.
7. **Operational history stores non-sensitive metadata only** — no patient names, addresses, auth numbers, compensation values.
8. **Notifications use controlled templates** — no free-text patient-like content in outreach.
9. **Travel cache uses location hashes** — never raw addresses as cache keys.
10. **All test data is synthetic** — no production data in any environment below production.
11. **Authorization is request-local** — deduplicate within one render, never cache user permissions across requests without explicit invalidation.
12. **Lists are bounded and projected** — database-side pagination/filtering/counts; no `select('*')` for list/read models.
13. **No per-row API calls** — batch or join derived data needed by a page.
14. **Reads do not perform maintenance writes** — derive time-based state; scheduled persistence is a stretch goal.
15. **Ordinary workflows respect RLS** — service-role access is reserved for true administrative operations.
