# Known Issues

Known limitations, risks, open product questions and environment gaps. Read at the start of every task (`plan-change`) and
update when a task completes (`complete-task`).

**Severity**: **S1** fix before real users or any real PHI; **S2** fix soon, or before the area it affects grows; **S3** low impact.
**Target** is the task or trigger by which the item must be revisited. Actionable items also get a GitHub issue (label `known-issue`).
A deferral is not a fix: add an item only with a severity and a target.

## Open

| ID | Sev | Issue | Impact | Target |
| --- | --- | --- | --- | --- |
| KI-002 | S2 | Vercel does not wait for the `CI ok` check before deploying. | A red `main` could still deploy if protection is bypassed. | Owner sets "wait for checks" in the Vercel project. |
| KI-003 | S2 | In the dashboard layout the whole page, including `<main>`, sits inside a wrapper with `aria-hidden="true"` (probably the MUI template's drawer). | Screen readers cannot see the page content. | Next UI task; look in `src/components/templates/crud-dashboard`. |
| KI-004 | S2 | `PermissionCode` in `src/types/index.ts` lists `reports.read`, which no database role grants and no code uses, and omits `authorizations.read_rates`, which the database defines (00017). The plan (6.0.1) ticks "add to PermissionCode" as done; it is not in `main`. | Type and database disagree; a future `read_rates` check will not type-check. | First Phase 6 task: add `authorizations.read_rates`; the product lead decides on `reports.read` (KI-015). |
| KI-005 | S3 | Several server actions skip the Zod boundary (INV-6): in `settings/users/actions.ts` the suspend, unsuspend, revoke, delete-invite, resend-invite, get and list actions take typed arguments; `login` and `accept-invite` validate by hand. | Inputs reach services unparsed (RLS still protects the data). | Issue #1 (user management standardization). |
| KI-006 | S3 | pgTAP covers the core tables and role escalation only. Missing: `organization_service_rates`, the authorization RPCs (including "a Scheduler gets compatibility but never a raw rate", plan 6.0.1), caregiver child tables, scheduling tables. | A policy mistake there would not be caught. | Each area's first change; add tests with it. |
| KI-007 | S3 | Browser tests cover sign-in, redirects, org isolation and one permission-gated page. No create/edit flow. | Form regressions are only caught by unit tests. | When a form changes; the plan's Phase 14 lists the target E2E workflows. |
| KI-008 | S3 | CodeQL is not a required check; secret-scanning non-provider patterns and validity checks are unavailable on this plan. | Findings do not block merges. | After a few clean CodeQL runs, add it to branch protection. |
| KI-009 | S3 | Local Node is newer than the pinned 22.x, so `npm` prints an engine warning. | Cosmetic. | Use `nvm use` (see `.nvmrc`). |
| KI-011 | S2 | The plan ticks Phase 6 items 6.0–6.4 (service, schemas, types, read models) as done, but `main` contains only the migrations and a placeholder page. Origin unknown (an unmerged branch, or never committed). | Risk of duplicated work, or of building on code that is not here. | Owner confirms before Phase 6 planning. |
| KI-012 | S3 | The plan's migration numbers are stale: it assigns `00017_shift_rpcs`, `00018_seed_rulesets_and_templates`, `00019_matching_rpcs`, `00020_call_off_rpcs`, but 00017 is already the authorization rate migration. | A literal reading would collide. | Use the next free number; update the plan when you reach each phase. |
| KI-013 | S1 | Credential numbers and prior-authorization numbers are stored unencrypted (`TODO(encrypt-credential-number)`; the plan's 6.1 defers encryption to pgsodium or Vault). | Unacceptable with real PHI. | Before any real PHI enters any environment. |
| KI-014 | S1 | Not yet built, by design of the MVP: MFA, formal ePHI audit logging, BAAs with Supabase/Vercel/AWS/notification provider, backup and recovery, incident response, export controls. The spec requires them before production PHI. | MVP is synthetic-data only. | The HIPAA production-readiness phase; never introduce real PHI before it. |
| KI-015 | S3 | Open product questions from the demo notes: Compliance Administrator can currently edit caregivers though the role is described as read-only; `reports.read` exists but nobody has it; Schedulers read caregiver records through the `shifts.manage` / `matching.run` policy clauses (not signed off); patient status definitions are unconfirmed (`TODO(patient-statuses)`); patient contact types are unconfirmed. | Behaviour may need to change once decided. | Product lead decides; record the decision in an ADR. |
| KI-016 | S3 | Caregiver service-eligibility and compensation forms take a raw `organization_service_id`; no credentials or eligibility rows exist in the seed data. | Awkward to use and to demo. | Phase 6 (an organization-service picker). |
| KI-017 | S2 | `docs/API_AUTHORIZATION_OPTIMIZATION_PLAN.md` is referenced by the plan and cheatsheet as mandatory for Phase 6 onward but is not in the repo. | Agents lack part of the required guidance. | Owner supplies it; until then apply the plan's "Optimization requirements" list and Key Rules 11–15. |
| KI-018 | S3 | Many `docs/QUERY_PERFORMANCE_BACKLOG.md` items are unchecked (parent-first streaming, bounded previews, single-record edit queries, index review). | Slower detail pages as data grows. | Apply per module as it is touched. |
| KI-019 | S3 | Docs drift: the plan and cheatsheet name `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the code uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The plan's folder tree omits the `(dashboard)` route group. | Confusing for a new contributor. | Update the docs when next edited. |

## Resolved

| ID | Resolution |
| --- | --- |
| KI-001 | Production migration push repaired (2026-10-14): a new `SUPABASE_ACCESS_TOKEN` was set and the workflow ran green. Production had 00001 to 00015; the run applied 00016 and 00017. The failure alert was also seen to fire. |
| KI-010 | Moot: production received 00017 from the repository's corrected version in the same run, so the function body is correct and no forward-fix migration is needed. |
| KI-020 | Labels created, squash-only merges and auto-delete of merged branches enabled (2026-10-13). |
| — | Migration 00017 used the reserved word `authorization` as an alias; renamed to `pa` (2026-10-12). See KI-010 for the forward-fix still needed. |
| — | Critical Next.js advisories and high `sharp` / `source-map-js` advisories fixed by `npm audit fix` (2026-10-12). |
