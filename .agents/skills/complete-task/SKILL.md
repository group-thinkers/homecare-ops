---
name: complete-task
description: Close out a task - evidence every acceptance criterion, update state docs, move the plan to completed, report.
---

# Complete Task

Run only after `verify-change` and `review-change` have no open P0/P1 findings.

1. Walk the plan's acceptance criteria one by one. Run the command and record the result. Mark `PASS` only with observed evidence;
   otherwise `UNVERIFIED (env)` or `FAIL`. A task with a FAIL or an unverified required criterion is not complete.
2. Run `npm run quality`, `supabase test db`, and `npm run test:e2e` as AGENTS.md requires; record counts.
3. Update docs in the same change: `docs/DATABASE.md` (if a migration landed), the plan's checkboxes in `docs/implementation-plan.md`
   for the phase, `ARCHITECTURE.md` if structure changed, and `docs/KNOWN_ISSUES.md` (move fixed rows to Resolved; every new deferral gets a severity and a target).
4. Update `docs/PROJECT_STATE.md`: what is now built, the exact next task, anything blocked.
5. Set the plan's Status to Completed and move it to `docs/plans/completed/`.
6. Report:

```text
TASK COMPLETE: <name>
Implemented / Acceptance criteria (PASS | UNVERIFIED | FAIL each, with evidence) /
Tests (command, result) / Migrations / Docs updated / Known issues / Next task
```

7. Create the next plan with `plan-change`. Do not push or open a PR without approval.
