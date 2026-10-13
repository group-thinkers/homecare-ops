# Architecture

How Daedalus (`homecare-ops`) is built. The schema, RLS and RPC reference is `docs/DATABASE.md`; the pattern for each layer
is `docs/IMPLEMENTATION_CHEATSHEET.md`. If the code disagrees with this file, fix the file (or write an ADR if the code is
wrong). Last reviewed 2026-10-13.

## Stack

Next.js 16 (App Router, React 19, server actions) · TypeScript · MUI Material 9 + X Data Grid (CRUD dashboard template) ·
controlled forms (no React Hook Form) · Zod 4 · Supabase (Postgres 17, Auth, RLS) · Amazon Location Service (planned, travel
time) · Vitest + Testing Library · Playwright · pgTAP. Hosting: Vercel (app) and Supabase Cloud (database). Node 22.

## Layers

```text
src/app/(auth)/*        login, logout, accept-invite (Supabase Auth used directly)
src/app/(dashboard)/*   pages (server components) + _components (client) + actions.ts (server actions)
src/lib/schemas/*       Zod schemas, .strict(): the validation boundary for every mutation
src/lib/services/*      the only code that reads/writes domain data in Supabase (tables or RPCs)
src/lib/permissions     hasPermission / requirePermission  ->  rpc has_org_permission
src/lib/auth            requireAuth, getActiveMembership, session-policy (cookies, timeouts)
src/lib/db              client.ts (user session; RLS applies), admin.ts (service role; auth.admin only), browser.ts
middleware.ts           refreshes the session, protects routes, enforces idle and absolute expiry
supabase/migrations     append-only SQL; applied to production on merge to main
supabase/tests          pgTAP tests (RLS, tenant isolation, permissions)
```

Request path for a write: component -> server action (`requireAuth` -> Zod parse -> `requirePermission`) -> service ->
Supabase under the user's JWT, so RLS applies. Multi-table or rule-checked writes go through `security definer` RPCs that
re-check permission inside the function (for example `create_patient_with_address`, `create_caregiver`). Server pages
authorize once and call read services directly; actions serve client-triggered reads and all mutations. Actions return
`ActionResponse<T>`.

## Tenancy and permissions

- One database, many agencies. Every tenant table has `organization_id`; policies call `has_org_permission(org_id, code)`.
- `organization_memberships.roles` is an array: Agency Administrator, Scheduler, Clinical Manager, HR Coordinator,
  Compliance Administrator. Only `Active` memberships grant anything.
- A permission comes from `role_permission_defaults` or an unexpired, unrevoked `membership_permission_grants` row.
  Role-to-permission defaults are in `docs/DATABASE.md` §3.
- Sensitive data has its own permission: caregiver pay rates (`caregivers.read_compensation`), reimbursement rates
  (`authorizations.read_rates`), clinical patient data (`patients.read_clinical`). Schedulers get non-financial
  compatibility results from a scheduler-safe RPC, never a raw rate.
- `anon` can reach the tables but no policy admits it, so it sees zero rows.

## Sessions

`middleware.ts` verifies the user with `supabase.auth.getUser()` on every request, redirects signed-out visitors to
`/login?redirectTo=…`, and enforces a 15-minute idle timeout and an 8-hour absolute limit via the `ho-last-activity` and
`ho-session-started` cookies (`src/lib/auth/session-policy.ts`). `SessionWatcher` is the client side. Signing out revokes
all of that user's sessions. MFA is required before any production PHI.

## Domain map (plan phases)

Foundation, users, patients, caregivers: built. Authorizations: database only. Shifts, matching, call-offs, notifications,
dashboard, operational history: not started. See `docs/PROJECT_STATE.md` for status and `docs/implementation-plan.md` for the plan.
Matching weights live in `src/lib/config/matching-ruleset-v1.json` (a database-backed lookup is the plan's Phase 3.2).

## Testing

| Layer | Where | Run |
|---|---|---|
| Unit (actions, services, schemas, components) | `tests/unit` | `npm test` |
| Database: RLS, tenant isolation, permissions, role escalation | `supabase/tests/database` | `supabase test db` |
| Browser: auth redirects, org isolation in the UI, permission-gated pages | `tests/e2e` | `npm run test:e2e` |

Browser tests do not detect an open RLS policy (the app also filters by organization); the pgTAP suite does.

## CI/CD

- `scripts/quality.sh` is the single entry point (`lint | typecheck | test | build | audit | full`); `npm run quality` runs `full`.
- `ci.yml` (PRs, pushes to main): lint, typecheck, unit, build, advisory audit, migrations + `supabase test db` on a fresh
  local Supabase, browser tests, and the `CI ok` gate (the required check on `main`).
- `nightly.yml`: enforced `npm audit` (high+), full gate, migrations from scratch; alerts Discord on failure.
- `codeql.yml` static analysis; `dependabot.yml` + `dependabot-automerge.yml` weekly updates (patch-only auto-merge).
- `supabase-migrate.yml`: on merge, pushes `supabase/migrations` to production; alerts Discord if it fails.
- Vercel deploys the app on merge. Rationale and settings: ADR-001.
