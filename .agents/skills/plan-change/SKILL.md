---
name: plan-change
description: Plan a plan-phase slice, feature, bug fix, migration or refactor before implementation. Produces docs/plans/active/<slug>.md. Use before any non-trivial change.
---

# Plan Change

Do not modify production code while executing this skill.

## Process

0. **Confirm the issue is yours.** Your developer names the issue. Run `scripts/work.sh check <n>`; if it says STOP (unclaimed, or held by someone else), stop and tell your developer. Never claim an issue yourself. Run `scripts/work.sh board` and `scripts/work.sh overlap` to see what is in flight and avoid colliding with it.
1. Restate the outcome and list non-goals (what later phases own).
2. Read `docs/PROJECT_STATE.md`, `docs/RULES.md`, `ARCHITECTURE.md`, and **only the sections you need** with `scripts/doc.sh` (never the whole file):
   the phase from the plan (`scripts/doc.sh plan "^## Phase N"`, including its "Optimization integration" list), the cheatsheet layers you will touch,
   the `docs/DATABASE.md` tables involved, and the open items in `docs/KNOWN_ISSUES.md` (`scripts/doc.sh known --list`). Pull in every open item that targets this work, or note why it stays deferred.
3. **Check the plan against reality**: the plan's checkboxes and file paths can be stale. Verify with the repository
   (`ls`, `grep`) what exists before assuming it does.
4. Inspect the closest existing implementation (patients, then caregivers) and reuse its patterns.
5. List affected layers: migration, types, schemas, service, actions, pages, components, nav, tests, `docs/DATABASE.md`.
6. Check the plan against the invariants and Key Rules in `AGENTS.md`, especially tenant isolation, two-place permission checks,
   money separation, bounded/projected reads, no per-row calls, transactions via RPC.
7. List unknowns and investigate the important ones. Anything that is a product decision the spec leaves open goes to the owner.
8. Define explicit, command-checkable acceptance criteria and a verification plan (unit, `supabase test db`, browser as needed).
9. Identify security, privacy (PHI), migration and compatibility risks.
10. Produce the smallest coherent ordered plan, one slice at a time, one commit per step.

## Output

Copy `docs/plans/TEMPLATE.md` to `docs/plans/active/<issue#>-<slug>.md` and fill it in. It records the issue, owner, branch, areas touched and the migration number you claim (the next free one, checked against `main` and open PRs). Sections: Status, Outcome, Non-Goals, Current State (verified), Known issues considered,
Decisions (confirm questionable ones before implementing), Proposed Design, Affected Files, Acceptance Criteria,
Verification Plan, Risks, Ordered Steps (checkboxes). Decisions a future contributor could reasonably question become ADRs (`write-adr`).
