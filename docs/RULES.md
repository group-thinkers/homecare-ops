# Rules

The detailed rules for implementing and reviewing changes. `AGENTS.md` (always loaded) keeps only the short version;
read this file when you plan, implement, verify or review. Moved here verbatim from `AGENTS.md`.

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

## Security

Never expose, print, modify or commit API keys, passwords, tokens or `.env` contents. Changes to auth, sessions,
permissions, RLS, grants or RPCs are security-sensitive: run `review-change` with the security checks and note the result
in the plan. Secret scanning and push protection are on; a blocked push is a signal, not an obstacle.
