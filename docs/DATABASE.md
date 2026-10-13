# DATABASE.md — Source of Truth for the Supabase Schema

> **This file describes the CURRENT state of the hosted Supabase database** (public schema) as of migration `00015`.
> It is a consolidated view: later migrations (`00005`, `00008`, `00009`) have been folded into the DDL below.
>
> **Rule for every phase:** when you add a migration, you MUST update this file in the same commit:
> 1. Bump "Applied through" below.
> 2. Add/alter the table DDL in §4, policies in §5, functions in §6, seed notes in §8.
> 3. Mirror any column/enum change into `src/types/index.ts` (see §9 for known drift).
>
> Optional but recommended after each deploy: `npm run db:dump` (see `docs/MIGRATIONS.md`) regenerates
> `supabase/schema.sql` from the live DB so you can diff it against this document.

**Applied through:** `00017_authorization_rate_security.sql`
**Migration files:** `supabase/migrations/` (sequential `000NN_snake_case.sql`)
**Types mirror:** `src/types/index.ts` (hand-written — keep in sync)

---

## 1. Conventions baked into the schema

| Convention | Detail |
|---|---|
| Primary keys | `id uuid primary key default gen_random_uuid()` |
| Tenant column | Every org-scoped table has `organization_id uuid not null`. Child tables use **composite FKs** `(organization_id, parent_id) references parent(organization_id, id)` so a child can never point across orgs. Parent tables therefore declare `unique (organization_id, id)`. |
| Enums | Plain `text` + `check (col in (...))`. No Postgres enum types. Mirror the literal list in `src/types/index.ts` and in the Zod schema. |
| Soft delete | **No DELETE policies anywhere.** Use `archived_at`, `active = false`, or a status value (`Archived`, `Cancelled`, `Revoked`). |
| Audit columns | `created_at` (default now), `created_by_user_id` (FK user_profiles) on primary entities; `updated_at`, `updated_by_user_id` set by app code (not triggers). |
| Append-only tables | `shift_assignment_history`, `call_off_outreach_events`, `operational_history_events`, `notifications` — no UPDATE/DELETE policies. |
| Deletes | `on delete restrict` for business FKs; `on delete cascade` only for `auth.users → user_profiles`, `user_profiles → platform_user_roles`, `memberships → permission_grants`, `matching_runs → matching_candidates`. |
| PHI-sensitive columns | `encrypted_prior_auth_number` / `masked_prior_auth_number`, `encrypted_credential_number`, `*_restricted_note_id` (pointer only — note storage is out of scope for MVP). Never log or return these in list views. |
| Timestamps | `timestamptz` everywhere; dates are `date`; times of day are `time`. |
| Numeric | money `numeric(10,2)`, coords `numeric(9,6)`, score `numeric(6,4)`. |

---

## 2. Security model (RLS + RPC)

- **RLS is enabled on every table.** All policies are `to authenticated`. `anon` has no policies → sees nothing.
- Policies delegate to three `security definer` helpers (§6): `is_org_member(org_id)`, `is_org_admin(org_id)`, `has_org_permission(org_id, perm_code)`.
- `has_org_permission` = (any of the member's `roles` has the permission in `role_permission_defaults`) **OR** (an unexpired, unrevoked row in `membership_permission_grants`).
- **Grants (00002/00007):** `authenticated` has `all` on all tables/sequences/routines in `public` — RLS is the only guard. Every new function must explicitly `revoke all ... from public; grant execute ... to authenticated;`.
- **Tables with NO authenticated INSERT/UPDATE policy** (writes must go through a `security definer` RPC, or the service-role admin client):

| Table | Missing for `authenticated` | Intended writer |
|---|---|---|
| `user_profiles` | INSERT | `create_org_member` RPC / auth trigger |
| `org_invites` | INSERT, UPDATE | `create_org_invite`, `complete_org_invite`, `delete_org_invite` RPCs |
| `shift_assignment_history` | INSERT | Shift assignment RPC (Phase 7) |
| `matching_runs` | UPDATE | Matching RPC (Phase 8) |
| `matching_candidates` | INSERT | Matching RPC (Phase 8) — UPDATE exists for `call_offs.manage` |
| `notifications` | INSERT, UPDATE | Notification RPC / admin client (Phase 10) |
| `travel_result_cache` | INSERT, UPDATE | Distance service (Phase 8) |
| `operational_history_events` | INSERT | `record_operational_event` RPC (Phase 7+, see plan §12) |
| `billing_services`, `service_code_mappings`, `matching_rulesets`, `notification_templates` | INSERT, UPDATE | Migrations/seed only (platform reference data) |

**Project decision:** multi-table transactional writes are implemented as **`security definer` plpgsql RPCs** (pattern: `create_patient_with_address`, `upsert_patient_requirement`). The service-role admin client (`src/lib/db/admin.ts`) is reserved for `auth.admin.*` calls. Supabase-js has no client-side transactions — if two tables must change atomically, it is an RPC.

---

## 3. Roles → permission defaults (seeded in 00001, table `role_permission_defaults`)

| Permission | Agency Administrator | Scheduler | Clinical Manager | HR Coordinator | Compliance Administrator |
|---|:-:|:-:|:-:|:-:|:-:|
| `users.manage` | ✅ | | | | |
| `patients.read_basic` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `patients.read_clinical` | ✅ | | ✅ | | ✅ |
| `patients.manage` | ✅ | | ✅ | | |
| `caregivers.manage` | ✅ | | ✅ | ✅ | ✅ |
| `caregivers.read_compensation` | ✅ | | | ✅ | ✅ |
| `authorizations.manage` | ✅ | | ✅ | | ✅ |
| `authorizations.read_rates` | ✅ | | ✅ | | ✅ |
| `shifts.manage` | ✅ | ✅ | | | |
| `matching.run` | ✅ | ✅ | | | |
| `call_offs.manage` | ✅ | ✅ | | | |
| `notifications.send` | ✅ | ✅ | | ✅ | |
| `dashboard.read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reports.read` | — not seeded for any role (exists in `PermissionCode` type only) | | | | |

Notes:
- Scheduler reads caregivers/availability/eligibility via `shifts.manage` / `matching.run` OR-clauses in those policies — no `caregivers.manage` needed.
- Compliance Administrator has `caregivers.manage` (write) despite being described as read-only — flag if this matters.

---

## 4. Tables — consolidated current DDL

Grouped by domain. `unique (organization_id, id)` on a parent means children reference it with a composite FK.

### 4.1 Identity & access

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Active' check (status in ('Active', 'Suspended', 'Archived')),
  timezone text not null,
  data_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  archived_at timestamptz
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text, -- 00008: nullable (stub profile until invite accepted)
  last_name text,  -- 00008: nullable
  phone text,
  access_status text not null default 'Pending' check (access_status in ('Active', 'Disabled', 'Pending')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  disabled_at timestamptz,
  disabled_by_user_id uuid references user_profiles(id)
);

create table platform_user_roles (
  user_id uuid not null references user_profiles(id) on delete cascade,
  role text not null check (role in ('Platform Administrator', 'Technical Support')),
  status text not null default 'Active' check (status in ('Active', 'Disabled')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  user_id uuid not null references user_profiles(id) on delete restrict,
  roles text[] not null default '{}', -- 00005: replaced `role text`; constraint membership_roles_valid: roles <@ {Agency Administrator, Scheduler, Clinical Manager, HR Coordinator, Compliance Administrator}
  status text not null default 'Active' check (status in ('Active', 'Suspended', 'Revoked')),
  joined_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_by_user_id uuid references user_profiles(id),
  last_access_review_at timestamptz,
  unique (organization_id, user_id)
);

create table role_permission_defaults (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  permission_code text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (role, permission_code)
);

create table membership_permission_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  membership_id uuid not null references organization_memberships(id) on delete cascade,
  permission_code text not null,
  reason text,
  granted_by_user_id uuid not null references user_profiles(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  roles text[] not null,
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Cancelled')),
  invited_by_user_id uuid not null references user_profiles(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz,
  unique (organization_id, invited_user_id)
);
```

### 4.2 Platform reference data (global, no organization_id; read-only for app users)

```sql
create table billing_services (
  id uuid primary key default gen_random_uuid(),
  billing_code text not null,
  code_match_type text not null check (code_match_type in ('Exact', 'Prefix')),
  service_name text not null,
  service_category text not null check (service_category in ( 'Aide', 'Nursing', 'Assessment', 'Personal Care', 'Homemaker', 'Other' )),
  default_unit_type text not null check (default_unit_type in ('Hour', 'Visit', 'Unit')),
  effective_start_date date not null,
  effective_end_date date,
  active boolean not null default true,
  source text not null,
  version text not null,
  approved_by_user_id uuid references user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (billing_code, version)
);

create table service_code_mappings (
  id uuid primary key default gen_random_uuid(),
  billing_service_id uuid not null references billing_services(id) on delete restrict,
  evv_service_id text not null,
  evv_service_name text not null,
  payer_type text not null,
  program_name text,
  effective_start_date date not null,
  effective_end_date date,
  active boolean not null default true,
  source text not null,
  version text not null,
  approved_by_user_id uuid references user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table matching_rulesets (
  id uuid primary key default gen_random_uuid(),
  ruleset_key text not null,
  version text not null,
  description text,
  configuration jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references user_profiles(id),
  unique (ruleset_key, version)
);

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  notification_type text not null,
  channel text not null check (channel in ('In-App', 'Email', 'SMS', 'Phone', 'Other')),
  audience text not null check (audience in ('Internal Staff', 'Caregiver', 'Administrator')),
  allowed_variables text[],
  sensitivity_classification text not null default 'General' check (sensitivity_classification in ('General', 'Operational', 'Restricted')),
  active boolean not null default true,
  version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (template_key, version)
);
```

### 4.3 Patients

```sql
create table patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  patient_external_id text,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date,
  status text not null default 'Intake' check (status in ('Intake', 'Active', 'Suspended', 'Discharged', 'Archived')),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references user_profiles(id),
  updated_at timestamptz,
  updated_by_user_id uuid references user_profiles(id),
  archived_at timestamptz,
  unique (organization_id, id)
);

create table patient_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  address_type text not null check (address_type in ('Service', 'Mailing', 'Other')),
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  zip_code text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_hash text,
  geocoding_provider text,
  geocoded_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict
);

create table patient_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  contact_type text not null,
  contact_name text not null,
  relationship text,
  phone text,
  email text,
  authorized_contact boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict
);

create table patient_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  requirement_type text not null check (requirement_type in ( 'Skill', 'Language', 'Gender Preference', 'Travel', 'Pets', 'Smoking', 'Lifting', 'Schedule', 'Other' )),
  requirement_code text not null,
  matching_effect text not null check (matching_effect in ( 'Required', 'Preferred', 'Review Required', 'Exclude' )),
  required_skill_code text,
  structured_value jsonb,
  restricted_note_id uuid,
  visibility_level text not null default 'Operational' check (visibility_level in ('Operational', 'Clinical', 'Restricted')),
  effective_start_date date,
  effective_end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict
);
```

Extra: `create unique index patients_org_external_id_idx on patients(organization_id, patient_external_id) where patient_external_id is not null;`

Application lifecycle/cardinality rules (covered by patient unit tests):
- Addresses have no historical row cap. The service replaces the active row for the same address type before inserting, so a patient has at most three active addresses (one each for `Service`, `Mailing`, and `Other`). Deactivation targets one address and sets `active = false` plus `archived_at`.
- Contacts have no historical row cap and at most five active rows per patient. A deactivated contact no longer counts toward the five-contact limit; deactivation targets one contact and sets `active = false` plus `archived_at`.
- Requirements have no total active-row cap, but `upsert_patient_requirement` maintains one active row per `(requirement_type, requirement_code)` pair. Deactivation targets one requirement and sets `active = false`.
- The patient-facing requirement workflow currently supports Language (`structured_value.language`), Gender Preference (`structured_value.gender_preference`), and minimum patient lifting capacity (`structured_value.minimum_patient_lifting_lbs`). Codes, matching effect, skill code, and visibility remain internal. Both effective dates are optional and remain `null` when omitted.

### 4.4 Payers, org services, authorizations

```sql
create table payers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  payer_name text not null,
  payer_type text not null check (payer_type in ( 'Medicare', 'Medicaid', 'Waiver', 'Managed Care', 'Private Pay', 'Other' )),
  program_name text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (organization_id, id)
);

create table organization_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  service_code_mapping_id uuid not null references service_code_mappings(id) on delete restrict,
  local_service_name text,
  default_reimbursement_rate numeric(10,2),
  default_rate_unit text not null default 'Hour' check (default_rate_unit in ('Hour', 'Visit', 'Unit')),
  requires_clinical_approval boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references user_profiles(id),
  updated_at timestamptz,
  updated_by_user_id uuid references user_profiles(id),
  unique (organization_id, id),
  unique (organization_id, service_code_mapping_id)
);

create table patient_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  payer_id uuid not null,
  encrypted_prior_auth_number text,
  masked_prior_auth_number text,
  authorization_start_date date not null,
  authorization_end_date date not null,
  status text not null default 'Active' check (status in ( 'Active', 'Pending Recertification', 'Under Review', 'Suspended', 'Expired' )),
  retention_category text,
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references user_profiles(id),
  updated_at timestamptz,
  updated_by_user_id uuid references user_profiles(id),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict,
  foreign key (organization_id, payer_id) references payers(organization_id, id) on delete restrict
);

create table authorization_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  authorization_id uuid not null,
  organization_service_id uuid not null,
  authorized_quantity numeric(10,2) not null,
  quantity_unit text not null check (quantity_unit in ('Hours', 'Visits', 'Units')),
  quantity_period text not null check (quantity_period in ( 'Day', 'Week', 'Month', 'Authorization Period' )),
  reimbursement_rate numeric(10,2),
  rate_unit text not null check (rate_unit in ('Hour', 'Visit', 'Unit')),
  service_requirement_code text,
  restricted_note_id uuid,
  effective_start_date date not null,
  effective_end_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, authorization_id) references patient_authorizations(organization_id, id) on delete restrict,
  foreign key (organization_id, organization_service_id) references organization_services(organization_id, id) on delete restrict
);

-- 00017: effective-dated organization fallback reimbursement rates.
-- New rate records are prospective; historical correction is a deferred workflow.
create table organization_service_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_service_id uuid not null,
  reimbursement_rate numeric(10,2) not null check (reimbursement_rate >= 0),
  rate_unit text not null check (rate_unit in ('Hour', 'Visit', 'Unit')),
  effective_start_date date not null,
  effective_end_date date,
  change_reason text not null,
  created_by_user_id uuid not null references user_profiles(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, organization_service_id)
    references organization_services(organization_id, id) on delete restrict,
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);
```

### 4.5 Caregivers

```sql
create table caregivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  employee_external_id text,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  classification text not null check (classification in ('RN', 'LPN', 'HHA', 'STNA')),
  employment_status text not null default 'Active' check (employment_status in ( 'Active', 'Inactive', 'Suspended', 'Terminated' )),
  max_hours_per_week numeric(5,2),
  service_area_zip text,
  travel_radius_miles numeric(6,2),
  matching_status text not null default 'Active' check (matching_status in ('Active', 'Inactive', 'Suspended')),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references user_profiles(id),
  updated_at timestamptz,
  updated_by_user_id uuid references user_profiles(id),
  archived_at timestamptz,
  unique (organization_id, id)
);

create table caregiver_compensation_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  caregiver_id uuid not null,
  organization_service_id uuid,
  pay_rate numeric(10,2) not null,
  rate_unit text not null check (rate_unit in ('Hour', 'Visit', 'Unit')),
  effective_start_date date not null,
  effective_end_date date,
  approved_by_user_id uuid not null references user_profiles(id),
  approved_at timestamptz not null,
  active boolean not null default true,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

create table caregiver_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  caregiver_id uuid not null,
  credential_type text not null,
  credential_name text not null,
  encrypted_credential_number text,
  issued_date date,
  expiration_date date,
  status text not null default 'Active' check (status in ('Active', 'Expired', 'Pending', 'Revoked')),
  verified_by_user_id uuid references user_profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

create table caregiver_service_eligibility (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  caregiver_id uuid not null,
  organization_service_id uuid not null,
  supervision_required boolean not null default false,
  approved_by_user_id uuid not null references user_profiles(id),
  approved_at timestamptz not null,
  active boolean not null default true,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict,
  foreign key (organization_id, organization_service_id) references organization_services(organization_id, id) on delete restrict
);

create table caregiver_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  caregiver_id uuid not null,
  skill_code text not null,
  skill_name text not null,
  verified_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

create table caregiver_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  caregiver_id uuid not null,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  availability_status text not null check (availability_status in ('Available', 'Unavailable', 'Preferred')),
  effective_start_date date not null,
  effective_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

create table caregiver_constraints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  caregiver_id uuid not null,
  constraint_type text not null,
  structured_value jsonb not null default '{}',
  matching_effect text not null check (matching_effect in ('Exclude', 'Review Required', 'Preference')),
  restricted_note_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);
```

Extra: `create unique index caregivers_org_employee_id_idx on caregivers(organization_id, employee_external_id) where employee_external_id is not null;`

`caregiver_availability.day_of_week`: 0 = Sunday … 6 = Saturday.

`caregiver_skills` app convention (00014 / Phase 5): the UI only offers the operational skill choices matching uses —
`skill_code` is derived, never typed, as `LANGUAGE:<language>`, `GENDER:<MALE|FEMALE>`, or `CAREGIVER_LIFTING_MAX_LB:<lb>`
(mirrors the patient requirement codes). One active row per `skill_code`; re-adding a code deactivates the prior row.

### 4.6 Shifts & matching

```sql
create table shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  authorization_service_id uuid not null,
  assigned_caregiver_id uuid,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  visit_type text not null,
  status text not null default 'Open' check (status in ( 'Open', 'Assigned', 'Replacement Needed', 'Covered', 'Uncovered', 'Completed', 'Cancelled' )),
  coverage_status text not null default 'Open' check (coverage_status in ( 'Open', 'Assigned', 'Call-Off Reported', 'Replacement Pending', 'Covered', 'Uncovered', 'Cancelled' )),
  assignment_confirmed_by_user_id uuid references user_profiles(id),
  assignment_confirmed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references user_profiles(id),
  updated_at timestamptz,
  updated_by_user_id uuid references user_profiles(id),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict,
  foreign key (organization_id, authorization_service_id) references authorization_services(organization_id, id) on delete restrict
);

create table shift_assignment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shift_id uuid not null,
  previous_caregiver_id uuid,
  new_caregiver_id uuid,
  change_type text not null check (change_type in ( 'Assigned', 'Reassigned', 'Call-Off', 'Replacement', 'Cancelled' )),
  reason_code text,
  changed_by_user_id uuid not null references user_profiles(id),
  changed_at timestamptz not null default now(),
  foreign key (organization_id, shift_id) references shifts(organization_id, id) on delete restrict
);

create table matching_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  shift_id uuid not null,
  authorization_service_id uuid not null,
  call_off_id uuid,
  initiated_by_user_id uuid not null references user_profiles(id),
  ruleset_version text not null,
  status text not null default 'Started' check (status in ( 'Started', 'Completed', 'Failed', 'Expired' )),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  foreign key (organization_id, shift_id) references shifts(organization_id, id) on delete restrict
);

create table matching_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  matching_run_id uuid not null references matching_runs(id) on delete cascade,
  caregiver_id uuid not null,
  score numeric(6,4) not null,
  recommendation_status text not null check (recommendation_status in ( 'Recommended', 'Review Required', 'Excluded' )),
  score_components jsonb,
  explanation_codes text[],
  review_flags text[],
  outreach_status text check (outreach_status in ( 'Not Contacted', 'Contacted', 'Notification Sent', 'Notification Failed' )),
  response_status text check (response_status in ( 'Pending', 'Interested', 'Accepted', 'Declined', 'No Response', 'Withdrawn', 'Selected' )),
  contacted_at timestamptz,
  responded_at timestamptz,
  selected_at timestamptz,
  selected_by_user_id uuid references user_profiles(id)
);
```

`shifts.version` is an optimistic-concurrency counter — increment on every status/assignment change and check it in the assignment RPC.

`matching_candidates` has **no** `unique (matching_run_id, caregiver_id)` — enforce in the RPC.

### 4.7 Call-offs

```sql
create table call_offs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shift_id uuid not null,
  original_caregiver_id uuid not null,
  reported_by_user_id uuid not null references user_profiles(id),
  reported_at timestamptz not null default now(),
  report_source text not null check (report_source in ( 'Phone', 'Text', 'Email', 'Internal', 'Other' )),
  reason_code text not null check (reason_code in ( 'Illness', 'Emergency', 'Transportation', 'Schedule Conflict', 'No Call / No Show', 'Other' )),
  restricted_reason_note_id uuid,
  status text not null default 'Reported' check (status in ( 'Reported', 'Replacement Needed', 'Candidates Available', 'Outreach In Progress', 'Pending Confirmation', 'Resolved', 'Unresolved', 'Cancelled' )),
  replacement_caregiver_id uuid,
  resolved_by_user_id uuid references user_profiles(id),
  resolved_at timestamptz,
  resolution_type text check (resolution_type in ( 'Covered', 'Missed', 'Delayed', 'Shortened', 'Cancelled', 'Other' )),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, shift_id) references shifts(organization_id, id) on delete restrict
);

create table call_off_outreach_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  call_off_id uuid not null,
  matching_candidate_id uuid references matching_candidates(id),
  caregiver_id uuid not null,
  contact_method text not null check (contact_method in ('Phone', 'Text', 'Email', 'Other')),
  outreach_status text not null check (outreach_status in ( 'Contacted', 'No Answer', 'Message Left', 'Notification Sent', 'Failed' )),
  response_status text not null default 'Pending' check (response_status in ( 'Pending', 'Interested', 'Accepted', 'Declined', 'No Response' )),
  contacted_by_user_id uuid not null references user_profiles(id),
  contacted_at timestamptz not null default now(),
  responded_at timestamptz,
  restricted_note_id uuid,
  created_at timestamptz not null default now(),
  foreign key (organization_id, call_off_id) references call_offs(organization_id, id) on delete restrict
);
```

`call_offs` has **no** partial unique index preventing two active call-offs per shift — enforce in the `report_call_off` RPC (or add `create unique index call_offs_one_active_per_shift on call_offs(organization_id, shift_id) where status not in ('Resolved','Unresolved','Cancelled')` in Phase 9).

### 4.8 Notifications, travel cache, operational history

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  template_id uuid not null references notification_templates(id),
  recipient_user_id uuid references user_profiles(id),
  recipient_caregiver_id uuid,
  channel text not null,
  notification_type text not null,
  sensitivity_classification text not null,
  contains_phi boolean not null default false,
  idempotency_key text,
  provider_message_id text,
  delivery_status text not null default 'Pending' check (delivery_status in ( 'Pending', 'Sent', 'Delivered', 'Failed', 'Cancelled' )),
  delivery_failure_reason_code text,
  approved_by_policy_version text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table travel_result_cache (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  origin_location_hash text not null,
  destination_location_hash text not null,
  travel_mode text not null,
  service_date date,
  distance_meters integer,
  travel_duration_seconds integer,
  provider text not null,
  calculated_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table operational_history_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  actor_user_id uuid references user_profiles(id),
  action_type text not null,
  resource_type text not null,
  resource_id uuid not null,
  related_patient_id uuid,
  related_caregiver_id uuid,
  related_shift_id uuid,
  related_call_off_id uuid,
  status text not null check (status in ('Success', 'Failed', 'Blocked', 'Cancelled')),
  summary_code text,
  metadata jsonb,
  request_id text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
```

### 4.9 Indexes (00001 + 00009)

```
org_memberships_user_idx(user_id) · org_memberships_org_idx(organization_id, status)
perm_grants_membership_idx(membership_id)
org_invites_org_status_idx(organization_id, status) · org_invites_user_idx(invited_user_id)
patients_org_status_idx(organization_id, status)
pat_addresses_patient_idx(organization_id, patient_id) · pat_contacts_patient_idx(organization_id, patient_id)
pat_requirements_patient_idx(organization_id, patient_id, visibility_level)
pat_auth_org_patient_idx(organization_id, patient_id, status) · auth_svc_auth_idx(organization_id, authorization_id)
organization_service_rates_lookup_idx(organization_id, organization_service_id, effective_start_date desc)
caregivers_org_status_idx(organization_id, matching_status, employment_status)
cg_comp_caregiver_idx · cg_creds_caregiver_idx · cg_svc_elig_caregiver_idx · cg_skills_caregiver_idx · cg_avail_caregiver_idx
cg_avail_exc_caregiver_idx — dropped in 00015 · cg_constraints_caregiver_idx
shifts_org_datetime_idx(organization_id, start_datetime, status) · shifts_org_patient_idx · shifts_org_caregiver_idx(organization_id, assigned_caregiver_id)
matching_runs_shift_idx(organization_id, shift_id) · matching_cands_run_idx(matching_run_id) · matching_cands_caregiver_idx(organization_id, caregiver_id)
call_offs_shift_idx(organization_id, shift_id, status) · call_off_events_calloff_idx(organization_id, call_off_id)
notifications_org_idx(organization_id, delivery_status) · notifications_recipient_idx(recipient_user_id)
travel_cache_lookup_idx(organization_id, origin_location_hash, destination_location_hash, travel_mode, service_date)
op_history_org_time_idx(organization_id, occurred_at desc) · op_history_resource_idx(resource_type, resource_id)
```

---

## 5. RLS policies — effective set per table

All `to authenticated`. `R` = SELECT, `I` = INSERT, `U` = UPDATE. No table has DELETE. `perm(x)` = `has_org_permission(organization_id, 'x')`.

| Table | R | I | U |
|---|---|---|---|
| organizations | `is_org_member(id)` | — | — |
| user_profiles | own row **or** co-member in same org whose membership is Active/Suspended (00003) | — | own row |
| platform_user_roles | own row | — | — |
| organization_memberships | `is_org_member` | `is_org_admin` | `is_org_admin` |
| role_permission_defaults | `true` | — | — |
| membership_permission_grants | `is_org_admin` | `is_org_admin` | `is_org_admin` |
| org_invites | `is_org_admin` | — (RPC) | — (RPC) |
| billing_services / service_code_mappings / matching_rulesets / notification_templates | `active = true` | — | — |
| patients / patient_addresses / patient_contacts | `perm(patients.read_basic)` | `perm(patients.manage)` | `perm(patients.manage)` |
| patient_requirements | Operational rows: `perm(patients.read_basic)`; Clinical/Restricted rows: `perm(patients.read_clinical)` | `perm(patients.manage)` | `perm(patients.manage)` |
| payers / organization_services | `is_org_member` | `perm(authorizations.manage)` | `perm(authorizations.manage)` |
| patient_authorizations | `perm(authorizations.manage) or perm(shifts.manage)` (00016) | `perm(authorizations.manage)` | `perm(authorizations.manage)` |
| authorization_services | `perm(authorizations.manage) or perm(shifts.manage)` | `perm(authorizations.manage)` | `perm(authorizations.manage)` |
| organization_service_rates | `perm(authorizations.manage) or perm(authorizations.read_rates)` | — (RPC) | — (RPC) |
| caregivers | `perm(caregivers.manage) or perm(shifts.manage) or perm(matching.run)` | `perm(caregivers.manage)` | `perm(caregivers.manage)` |
| caregiver_compensation_rates | `perm(caregivers.read_compensation)` | `perm(caregivers.manage) and perm(caregivers.read_compensation)` | same as I |
| caregiver_credentials | `perm(caregivers.manage)` | `perm(caregivers.manage)` | `perm(caregivers.manage)` |
| caregiver_service_eligibility / caregiver_skills / caregiver_constraints | `perm(caregivers.manage) or perm(matching.run)` | `perm(caregivers.manage)` | `perm(caregivers.manage)` |
| caregiver_availability | `perm(caregivers.manage) or perm(shifts.manage) or perm(matching.run)` | `perm(caregivers.manage)` | `perm(caregivers.manage)` |
| shifts | `perm(shifts.manage) or perm(matching.run)` | `perm(shifts.manage)` | `perm(shifts.manage)` |
| shift_assignment_history | `perm(shifts.manage)` | — (RPC) | — |
| matching_runs | `perm(matching.run) or perm(shifts.manage)` | `perm(matching.run)` | — (RPC) |
| matching_candidates | `perm(matching.run) or perm(shifts.manage)` | — (RPC) | `perm(call_offs.manage)` |
| call_offs | `perm(call_offs.manage) or perm(shifts.manage)` | `perm(call_offs.manage)` | `perm(call_offs.manage)` |
| call_off_outreach_events | `perm(call_offs.manage)` | `perm(call_offs.manage)` | — |
| notifications | `perm(notifications.send)` **or** `recipient_user_id = auth.uid()` | — (RPC/admin) | — |
| travel_result_cache | `is_org_member` | — (RPC/admin) | — |
| operational_history_events | `perm(dashboard.read)` | — (RPC) | — |

Schedulers with `shifts.manage` can read both authorization parents and services (00016), but authorization mutations remain restricted to `authorizations.manage`.

---

## 6. Functions / RPCs — current inventory

All are `security definer`, `set search_path = public`, `revoke all from public; grant execute to authenticated`. Authorization is re-checked **inside** each RPC (never trust the caller).

### 6.1 RLS helpers (sql, stable)
| Function | Returns | Logic |
|---|---|---|
| `is_org_member(org_id uuid)` | boolean | active membership exists for `auth.uid()` |
| `is_org_admin(org_id uuid)` | boolean | active membership with `'Agency Administrator' = any(roles)` (00005) |
| `has_org_permission(org_id uuid, perm_code text)` | boolean | role defaults OR live explicit grant (00005) |
| `can_manage_org_users(target_org_id uuid)` | boolean | `has_org_permission(_, 'users.manage')` (00003) |
| `can_manage_org_patients(org_id)` / `can_read_org_patients(org_id)` / `can_read_org_patients_clinical(org_id)` | boolean | thin wrappers over `has_org_permission` (00011) |
| `can_manage_org_caregivers(org_id)` / `can_read_org_compensation(org_id)` | boolean | thin wrappers over `has_org_permission` (00014) |
| `can_manage_org_authorizations(org_id)` / `can_read_org_authorizations(org_id)` | boolean | `authorizations.manage`; read helper also permits `shifts.manage` (00016) |

### 6.2 User management RPCs (plpgsql)
| Function | Args | Returns | Notes |
|---|---|---|---|
| `create_org_member` | `(target_org_id uuid, target_user_id uuid, initial_roles text[])` | `organization_memberships` | inserts stub `user_profiles` row `on conflict do nothing` (00008) |
| `create_org_invite` | `(target_org_id, target_user_id, target_email text, initial_roles text[], invite_expires_at timestamptz default null)` | `org_invites` | admin only (00009) |
| `complete_org_invite` | `(target_org_id uuid)` | `organization_memberships` | caller = invited user; creates membership + marks invite Accepted (00009) |
| `list_pending_org_invites` | `(target_org_id uuid)` | `table(invite_id, user_id, email, roles, invited_at, expires_at)` | scoped to caller's org (00010) |
| `delete_org_invite` | `(target_org_id, target_user_id)` | void | (00009) |
| `set_org_member_roles` | `(target_org_id, target_user_id, new_roles text[])` | `organization_memberships` | (00005) |
| `suspend_org_member` / `unsuspend_org_member` | `(target_org_id, target_user_id)` | `organization_memberships` | (00003) |
| `revoke_org_member` | `(target_org_id, target_user_id)` | `organization_memberships` | (00004) |

Dropped: `update_org_member_role` (00005), `add_org_member_role`, `remove_org_member_role` (00006).

### 6.3 Patient RPCs (00011)
| Function | Args | Returns |
|---|---|---|
| `create_patient_with_address` | `(target_org_id uuid, first_name text, last_name text, middle_name text, date_of_birth date, patient_external_id text, status text default 'Intake', address_line_1 text, address_line_2 text, city text, state text, zip_code text, latitude numeric, longitude numeric)` | `patients` |
| `upsert_patient_requirement` | `(target_org_id uuid, target_patient_id uuid, req_type text, req_code text, matching_effect text, required_skill_code text, structured_value jsonb, restricted_note_id uuid, visibility_level text, effective_start_date date default null, effective_end_date date default null)` | `patient_requirements` — one active row per (type, code) |
| `list_patient_requirements_by_visibility` | `(target_org_id uuid, target_patient_id uuid, target_visibility text)` | `setof patient_requirements` |

### 6.4 Triggers

**None exist.** `00001` comments say `user_profiles` INSERT is "handled by service_role trigger on auth.users" but no trigger was ever created; `create_org_member` (00008) inserts the stub profile instead. Plan §1.4 (`handle_new_user`) is therefore superseded.

### 6.5 Caregiver RPCs (00014)
| Function | Args | Returns |
|---|---|---|
| `create_caregiver` | `(target_org_id uuid, first_name text, last_name text, classification text, email text default null, phone text default null, employee_external_id text default null, max_hours_per_week numeric default null, service_area_zip text default null, travel_radius_miles numeric default null)` | `caregivers` — validates classification, stamps `created_by_user_id = auth.uid()` |
| `upsert_caregiver_availability` | `(target_org_id uuid, target_caregiver_id uuid, day_of_week smallint, start_time time, end_time time, availability_status text, effective_start_date date, effective_end_date date default null)` | `caregiver_availability` — rejects `end_time <= start_time` and overlapping windows on the same day whose effective ranges intersect (`'Availability window overlaps an existing window'`) |
| `set_caregiver_compensation_rate` | `(target_org_id uuid, target_caregiver_id uuid, pay_rate numeric, rate_unit text, effective_start_date date, organization_service_id uuid default null)` | `caregiver_compensation_rates` — requires `caregivers.manage` **and** `caregivers.read_compensation`; closes the current active rate for the same service (null-safe) at `effective_start_date - 1`, inserts the new rate with `approved_by_user_id = auth.uid()` |
| `mark_expired_credentials` | `(target_org_id uuid)` | `integer` — flips `Active` credentials past `expiration_date` to `Expired`; called opportunistically by `listCaregivers` |

Also in 00014: `alter table caregiver_availability_exceptions add column active boolean not null default true` — superseded by 00015, which drops that table entirely.

### 6.6 Schema removals (00015)

`caregiver_availability_exceptions` (table, index `cg_avail_exc_caregiver_idx`, and its three RLS policies) was **dropped** — the feature was redundant with `caregiver_availability`'s effective date ranges. Nothing referenced it; it was a leaf child of `caregivers`.

### 6.7 Authorization RPCs (00016)
| Function | Args | Returns | Notes |
|---|---|---|---|
| `create_authorization_with_services` | `(target_org_id uuid, target_patient_id uuid, target_payer_id uuid, authorization_start_date date, authorization_end_date date, status text default 'Active', prior_auth_number text default null, services jsonb default '[]')` | `patient_authorizations` | validates caller, patient, payer, service scope, dates, and enum values; creates authorization plus service rows atomically; masks prior auth number |

### 6.8 Authorization rate security and history (00017)
| Function | Args | Returns | Notes |
|---|---|---|---|
| `check_authorization_service_compatibility` | `(target_org_id, target_patient_id, target_organization_service_id, service_date)` | authorization/service/rate flags and safe reason/source codes | scheduler-safe; requires `authorizations.manage` or `shifts.manage`; never returns a monetary amount or unit |
| `set_organization_service_rate` | `(target_org_id, target_organization_service_id, reimbursement_rate, rate_unit, effective_start_date, change_reason)` | `organization_service_rates` | `authorizations.manage`; prospective only; closes the prior period, inserts a version, and records an operational event atomically |
| `get_effective_organization_service_rates` | `(target_org_id, target_organization_service_ids uuid[], service_date)` | effective rate rows | batched raw-rate lookup for authorized detail pages |

---

## 7. `Database` type in `src/types/index.ts` — RPC signatures registered

`has_org_permission, is_org_member, is_org_admin, can_manage_org_users, create_org_invite, complete_org_invite, create_org_member, list_pending_org_invites, delete_org_invite, suspend_org_member, unsuspend_org_member, set_org_member_roles, revoke_org_member, create_patient_with_address, upsert_patient_requirement, list_patient_requirements_by_visibility, can_manage_org_caregivers, can_read_org_compensation, create_caregiver, upsert_caregiver_availability, set_caregiver_compensation_rate, mark_expired_credentials, can_manage_org_authorizations, can_read_org_authorizations, can_read_org_authorization_rates, create_authorization_with_services, check_authorization_service_compatibility, set_organization_service_rate, get_effective_organization_service_rates`.

**All RPCs are registered** — no `rpc()` call uses `as never`. Every new RPC must be added to `Database.public.Functions` so the cast stays unnecessary.

---

## 8. Seed data (dev only — `supabase/seed/` is git-ignored because it contains plaintext passwords)

| File | Contents | Run via |
|---|---|---|
| `seed-users.ts` | creates 7 auth users (2 orgs) | `npx tsx supabase/seed/seed-users.ts` |
| `billing_services.sql` / `service_code_mappings.sql` | Ohio Medicaid EVV codes — **now also in migration 00012**, so these are redundant | SQL editor |
| `seed.sql` | 2 orgs (`…0001` Sunrise Home Care, `…0002` Buckeye Care Services), 7 profiles, memberships, **21 patients** (15 Sunrise incl. 1 Archived, 6 Buckeye) + 12 addresses, 2 payers, 2 org services, **21 caregivers** (15 Sunrise incl. 1 Archived, 6 Buckeye) with 34 skills, 29 availability windows and 22 compensation rates, 2 authorizations + auth services, 2 shifts | SQL editor |
| `reset.sql` | truncates everything + deletes seed auth users | SQL editor |

Seed ID convention: `00000000-0000-0000-{segment}-{n}` where segment = `0000` orgs, `0001`/`0002` users per org, `0003` patients, `0004` patient addresses, `0006` payers, `0007` organization services, `0008` caregivers, `0009` authorizations, `0010` authorization services, `0011` memberships **and** shifts (different tables, so the reuse is harmless), `0012` caregiver skills, `0013` caregiver availability, `0014` caregiver compensation rates, `0022` Buckeye memberships. Migration 00012 uses `30000000-…` for `service_code_mappings`. Pick a new unused segment per table when extending seeds.

Not seeded for caregivers: `caregiver_service_eligibility` and `caregiver_credentials` (both still need design work), and `GENDER:` skill codes.

**Volume matters for the list pages.** Each org deliberately holds more rows than the default page size (`DEFAULT_PAGE_SIZE = 10`): Sunrise has 14 non-archived caregivers and 14 non-archived patients, Buckeye 6 of each. Keep it that way — when Sunrise held only 5 caregivers, a single page covered the whole table, the next-page control stayed disabled, and server pagination looked broken when it was in fact correct.

Reference data present in the live DB: `billing_services` (16 rows), `service_code_mappings` (22 rows), `role_permission_defaults`. **Absent:** `matching_rulesets` rows (config lives in `src/lib/config/matching-ruleset-v1.json`), `notification_templates` rows.

---

## 9. Known drift between SQL and `src/types/index.ts` (fix when touching the area)

| Area | SQL | Types | Action |
|---|---|---|---|
| `user_profiles.first_name/last_name` | nullable (00008) | `string` | change to `string \| null` |
| `matching_rulesets` | table exists | missing from `Database.Tables` and no row type | add `MatchingRuleset` type when Phase 3/8 seeds it |
| `call_off_outreach_events.contact_method` | `Phone, Text, Email, Other` | typed as `CallOffReportSource` (includes `Internal`) | add `OutreachContactMethod` type |
| `caregiver_constraints.matching_effect` | `Exclude, Review Required, Preference` | inline literal ✔ | patient side uses `Preferred` — don't share the enum |
| `PermissionCode 'reports.read'` | not seeded to any role | present | harmless; leave |
| `Database.Functions` | all RPCs registered ✔ | see §7 | none — keep new RPCs registered |

---

## 10. Planned schema work (Phases 5–9) — see `implementation-plan.md`

No new **tables** are expected for Phases 5–9; the schema is complete. Expected migrations are **RPCs, indexes, and policy tweaks only**:

| Phase | Migration | Purpose |
|---|---|---|
| 5 | `00014_caregiver_rpcs.sql` | **APPLIED** — `create_caregiver`, `upsert_caregiver_availability`, `set_caregiver_compensation_rate` (closes prior active rate), `mark_expired_credentials`, helpers `can_manage_org_caregivers` / `can_read_org_compensation`, `caregiver_availability_exceptions.active`. Credentials/skills/eligibility are plain RLS-guarded writes, so no `upsert_caregiver_credential` RPC was needed. |
| 5 | `00015_drop_caregiver_availability_exceptions.sql` | **APPLIED** — drops `caregiver_availability_exceptions` (redundant with `caregiver_availability` effective date ranges) |
| 6 | `00016_authorization_rpcs.sql` | `create_authorization_with_services`; lets `shifts.manage` read `patient_authorizations` |
| 7 | `00017_shift_rpcs.sql` | `confirm_shift_assignment` (version check, conflict check, history insert), `cancel_shift`, `set_shift_coverage`, `record_operational_event` |
| 3 | `00018_seed_rulesets_and_templates.sql` | insert `matching_rulesets` v1 + 4 `notification_templates` |
| 8 | `00019_matching_rpcs.sql` | `persist_matching_run(run jsonb, candidates jsonb)` (inserts run + candidates, sets Completed), `upsert_travel_cache` |
| 9 | `00020_call_off_rpcs.sql` | `report_call_off`, `confirm_replacement`, `mark_call_off_unresolved`; partial unique index one-active-call-off-per-shift |
