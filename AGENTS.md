<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Engineering Guide

Always-loaded entry point; keep it short. Detail lives in `/docs` and is read on demand (see "Reading docs cheaply").
The project is built mostly by agents: a session must continue from the repository alone, with no chat history.

## Mission

**Daedalus** (`homecare-ops`): the Healthcare Operations Command Center for home-care agencies (patients, caregivers,
authorizations and rates, shifts, matching, call-off replacement, notifications, dashboard) for many agencies in one database.
The MVP must show: faster call-off replacement, better caregiver-patient fit, less manager time.
> An agency must be able to trust that it only sees its own data, and that staff only see what their role allows.

**Data policy.** Synthetic or de-identified data only. Real PHI must not enter any environment before the HIPAA
production-readiness work is done. Never copy production data into dev, test or preview, and never put patient-like data in
fixtures, logs, URLs or commits. The repository is public.

## Session Start (read only this, in order)

1. Your developer names the issue to work on. **Agents never claim, release or assign issues**; developers do (`scripts/work.sh claim <n>`).
   Run `scripts/work.sh check <n>`: if it says STOP (unclaimed, or held by someone else), stop and tell your developer. Then
   `scripts/work.sh board` shows who is doing what (~150 tokens).
2. `docs/PROJECT_STATE.md`: what is built and what is blocked.
3. Your plan: `docs/plans/active/<issue#>-<slug>.md` (one per task; read only yours); continue from its first unchecked step.
4. `git status`, `git log -5`, then `npm run quality`. It must be green first; if not, fixing it is the first task.
5. Before ending, append to your plan's **Progress log** so another agent can continue. `PROJECT_STATE.md` changes only at `complete-task`.

Read more **only when the task needs it**, and only the part you need:
- Planning or implementing: `docs/RULES.md`, plus the phase from the plan and the layers you touch from the cheatsheet.
- Touching structure: `ARCHITECTURE.md`. Touching the database: the `add-migration` skill and the relevant `docs/DATABASE.md` sections.
- Open issues: `scripts/doc.sh known --list`, then the row you need. Decisions: `docs/decisions/README.md` (skim the newest).
- Where things are: tests in `tests/unit/` (vitest), `supabase/tests/database/` (pgTAP), `tests/e2e/` (Playwright); plans in `docs/plans/`; work items in GitHub Issues.

## Coordination (several people and agents work in parallel)

GitHub is the shared memory: issues (assignee = the developer who owns it), draft PRs (what is in flight), `scripts/work.sh overlap` (who touches your files).
Work in your own worktree: `git worktree add ../wt-<slug> -b <type>/<issue#>-<slug> origin/main`. Claim the next migration number in
your plan before writing it. Before a PR: `git fetch && git rebase origin/main`, re-run `npm run quality`. Details and the shared hot files: `docs/RULES.md`.

## Reading docs cheaply

The plan alone is about 24k tokens; the cheatsheet 8k; `DATABASE.md` 13k. Do not read them whole. Use:

```bash
scripts/doc.sh plan --list              # outline with line numbers
scripts/doc.sh plan "^## Phase 6"       # one section (~3.7k tokens)
scripts/doc.sh cheat "Migrations"       # aliases: plan cheat db mig perf known state arch
```

Use `offset`/`limit` when reading any large file, search with Grep before reading, and do not re-read a file you just edited.

## Precedence

This file → accepted ADRs (`docs/decisions/`) → the product spec (v1 draft, not in this repo; ask the owner) →
`docs/implementation-plan.md` → `docs/IMPLEMENTATION_CHEATSHEET.md` → `docs/DATABASE.md`, `docs/MIGRATIONS.md`,
`docs/QUERY_PERFORMANCE_BACKLOG.md` → code and tests → judgment. Never silently diverge from the spec or plan: write an ADR
first (`write-adr`). The plan and cheatsheet date from 2026-09-09; where they disagree with the code, `PROJECT_STATE.md` says which is right.

## Workflow

Skills in `.agents/skills/` (also `.claude/skills`): `plan-change → implement-change → verify-change → review-change → harden-change → complete-task → prepare-pr`,
plus `add-migration` and `write-adr`. Build one entity vertical slice at a time in the cheatsheet's order: **migration → types →
schemas → service → actions → pages → components → nav → tests → verify.** Non-trivial work gets a plan from `docs/plans/TEMPLATE.md`.
Finish a whole slice before the next; finished plans move to `docs/plans/completed/`. Branch `<type>/<issue#>-<slug>` (`feat/ fix/ chore/ ci/ docs/ test/`), never `main`; one Conventional Commit per coherent unit. Done means each acceptance criterion is evidenced by a command and its output.

## Hard rules (full list and invariants in `docs/RULES.md`)

- **Tenant isolation and permissions are checked twice:** server action `requirePermission` and the database (RLS / `security definer` RPC). Organization comes from the membership, never from the browser.
- **Actions:** authenticate → validate (Zod `.strict()`) → permission → service → revalidate. Services hold all Supabase access.
- **Migrations are append-only** (merging deploys them to production); every new table enables RLS; test with `supabase test db`.
- **Money stays separate** (caregiver pay / reimbursement / approved service rate), never in lists, logs or events. No patient data in logs.
- **Verification:** label results VERIFIED / UNVERIFIED (env) / ASSUMED. Never weaken a failing test. Stuck after two attempts: stop and ask.
- **Git:** never force push, never push or merge to `main`, never discard user work. Committing on a branch is fine; **pushing, opening or merging a PR, and any repo/Vercel/Supabase setting change need explicit approval** (or a standing approval recorded in `PROJECT_STATE.md`).
- **Merging to `main` deploys** (Vercel ships the app; a workflow applies new migrations to production): treat every merge as a release.
- **Secrets:** never expose, print or commit keys, passwords, tokens, `.env*` or seed files with passwords (`supabase/seed/` is git-ignored).
- **Ask only for:** missing credentials, destructive or irreversible actions, compliance choices (for example PHI retention or the notification provider), product decisions the spec leaves open, installing software, anything that publishes. Otherwise choose the simplest production-quality option, record it, continue. If a tool is missing (Docker, Supabase CLI, browser) do not fake it: mark the criterion `UNVERIFIED (env)` in `docs/KNOWN_ISSUES.md` and continue.
