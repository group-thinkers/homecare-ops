# ADR-001: CI/CD and repository protection

Status: Accepted · Date: 2026-10-13

## Context
The repository had Discord notifications and a production migration workflow, but no CI. The migration workflow
could ship to production with nothing in front of it, and it had been failing silently for weeks. The project is built mostly
by agents, so the gates must be automatic and must run the same commands an agent runs locally.

## Decision
- One entry point, `scripts/quality.sh`, used by humans, agents and CI, so local and CI checks cannot drift.
- `ci.yml` runs independent jobs in parallel and a single `CI ok` job that depends on the required ones; `CI ok` is the
  only required status check on `main`.
- Database changes are tested against a fresh local Supabase (`supabase start`, the Supabase CLI rather than a plain Postgres
  container, because the schema uses `auth.users` and `auth.uid()`): every migration applies, then pgTAP tests check RLS,
  tenant isolation and permissions. Browser tests (Playwright) run against a production build on the same stack.
- Dependency audit is advisory on pull requests (new advisories appear without a code change and must not block unrelated
  work) and enforced nightly at high severity or above, with a Discord alert.
- Dependabot proposes weekly grouped minor/patch updates and separate PRs for majors; patch-only updates auto-merge once
  `CI ok` passes. Dependabot security updates, secret scanning, push protection and CodeQL are on.
- Branch protection on `main`: a pull request and `CI ok` are required, no approvals (so an author can merge their own PR),
  applies to admins, conversations must be resolved, no force pushes or deletions.
- Actions are pinned to commit SHAs; Dependabot keeps them current. Node is pinned to 22.x (`.nvmrc`, `engines`).
- A failed production migration push alerts Discord.

## Alternatives
- Plain Postgres service container for migrations: faster, but cannot represent Supabase's `auth` schema.
- Requiring one approving review: blocks developers from merging their own PRs, which the owner wants to allow.
- Enforcing the audit on every PR: noisy, blocks unrelated changes.

## Consequences
- Every merge to `main` is a release (Vercel deploys the app; a workflow applies new migrations to production).
- Admins cannot bypass a red `CI ok`; a broken pipeline is fixed through a PR that passes it.
- Auto-merge of patch updates trusts the test suite; weak coverage in an area means weaker protection there (KI-006, KI-007).

## Revisit when
CodeQL has been clean for a while (make it required); a second developer joins (consider one required review); coverage
gaps in KI-006/007 close (consider auto-merging minor updates); Vercel "wait for checks" is configured (KI-002).
