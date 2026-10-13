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
4. Update `docs/PROJECT_STATE.md` with a **minimal diff** (only the status rows this task changed, or newly blocked items); `git fetch && git rebase origin/main` first so you edit the current text. There is no "next task" there: the work board is GitHub Issues. Close out the plan's Progress log with a final line.
5. Set the plan's Status to Completed and move it to `docs/plans/completed/`.
6. Report:

```text
TASK COMPLETE: <name>
Implemented / Acceptance criteria (PASS | UNVERIFIED | FAIL each, with evidence) /
Tests (command, result) / Migrations / Docs updated / Known issues / Next task
```

7. Do not push or open a PR without approval. Do not start another issue yourself: report to your developer, who names the next one.
