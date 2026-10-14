# How we build with agents

A short overview for people. Agents read `AGENTS.md`; this page is the human version. Agents do the building; developers decide
what gets built and who owns it. Everything an agent needs is in the repo, so a session can resume without chat history and several
people can work at once.

## Who does what

| Developers | Agents |
|---|---|
| Create and **claim** issues: `scripts/work.sh claim <n>` | Confirm the issue is theirs: `scripts/work.sh check <n>` |
| Tell their agent which issue to work on | Plan, build, test, review and document it |
| Approve any push, PR or settings change | **Never** claim, assign or release an issue |
| Merge their own PRs once `CI ok` is green | **Never** push, open a PR or merge without approval; stop and ask after two failed attempts |

## One task, start to finish

1. Developer claims the issue and names it to the agent.
2. `plan-change`: plan first, in `docs/plans/active/<issue#>-<slug>.md`, with acceptance criteria that are commands.
3. `implement-change`: one vertical slice in a fixed order (migration, types, schemas, service, actions, pages, components, nav, tests). Database work follows `add-migration`.
4. `verify-change`: an independent pass that tries to break it (wrong organization, wrong role). Results are labelled VERIFIED, UNVERIFIED (env) or ASSUMED.
5. `review-change`: read-only review for tenant isolation, permissions, pay vs reimbursement rates, and PHI. Findings graded P0 to P3.
6. `harden-change`, then `complete-task`: simplify, evidence every criterion, update docs, move the plan to `completed/`.
7. `prepare-pr`: rebase, draft the PR, then wait. The developer approves the push, CI runs, the developer merges.

## Where things live

| File | Purpose |
|---|---|
| `AGENTS.md` | Always loaded by agents: mission, data policy, session start, hard rules |
| `docs/RULES.md` | The key rules, invariants and contributor rules (read when planning, building, reviewing) |
| `docs/PROJECT_STATE.md` | What is built and what is blocked |
| `docs/KNOWN_ISSUES.md` | Tracked gaps by severity (S1 to S3) |
| `docs/decisions/` | ADRs: 001 CI/CD, 002 coordination |
| `docs/plans/` | `TEMPLATE.md`, `active/` (one plan per issue), `completed/` |
| `docs/implementation-plan.md`, `IMPLEMENTATION_CHEATSHEET.md`, `DATABASE.md` | The team's plan, per-layer patterns, schema reference |
| `.agents/skills/` | The nine skills (also visible as `.claude/skills`) |

Read one section of a doc instead of the whole file (the plan alone is about 24k tokens):

```bash
scripts/doc.sh plan --list             # outline
scripts/doc.sh plan "^## Phase 6"      # one section
scripts/work.sh board                  # who is doing what
scripts/work.sh overlap                # other open PRs touching your files
```

## Sprints and the project board

[Homecare Ops Project Board](https://github.com/orgs/group-thinkers/projects/1) is the sprint view over the issues (two-week iterations).
Columns: Backlog, Ready, In progress, In review, Done. Issues stay the source of truth; the board is for planning and for seeing what is moving.
Developers choose each sprint's issues and move cards. Agents do not edit the board, as with claiming. `Ready` means no hard dependencies and not
`needs-owner`; blocked issues sit in Backlog until their dependencies merge.

## What keeps it safe

- One required check, `CI ok`: lint, typecheck, unit tests, build, RLS and permission tests on a fresh local Supabase, browser tests, and the migration-order check. It applies to admins too; no approvals are required.
- `scripts/check-migrations.sh` fails duplicate or gapped migration numbers and any edit, delete or rename of a merged migration (production applies migrations on merge). A justified edit needs a line in `supabase/migration-edits.allow`.
- CodeQL, secret scanning with push protection, Dependabot (patch updates merge themselves), a nightly audit, and Discord alerts when the nightly fails, the production migration push fails, or `main` goes red.
- Synthetic data only; real PHI stays out until the HIPAA readiness work is done. This repository is public.

## Working in parallel

GitHub is the shared memory: issues show owners, draft PRs show what is in flight. Use one git worktree per task and rebase on
`main` before a PR. One plan per issue, with a progress log, so handoffs never conflict; `PROJECT_STATE.md` changes only when a task
completes. Squash merges only. Details and the shared hot files: `docs/RULES.md`.
