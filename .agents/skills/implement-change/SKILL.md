---
name: implement-change
description: Implement an approved plan as a vertical slice, following the cheatsheet's build order, with tests, on a feature branch.
---

# Implement Change

Before modifying code: read the active plan and `docs/PROJECT_STATE.md`; confirm `git status` and that you are on a feature
branch; read `docs/RULES.md` and, with `scripts/doc.sh cheat "<layer>"`, only the cheatsheet sections for the layers you touch; inspect the existing pattern (`patients`) first.

Build in this order and finish the whole slice before the next entity:
**migration → types → schemas → service → actions → pages → components → nav → tests → verify.**

During implementation:
- Match the cheatsheet exactly: naming, `.strict()` schemas with `organizationId` first, services that filter by `organization_id` on every
  query (log and return on read errors, log and throw on write errors), actions in the order authenticate → validate → permission → service → revalidate.
- Sensitive fields are excluded in the service, not the UI. List reads use explicit projections, database pagination and counts, and a
  deterministic order. No per-row calls. No maintenance writes in reads. Transactions are RPCs.
- Database work follows `add-migration`. Update `docs/DATABASE.md` in the same commit as any migration.
- Tests ship with the code in the same commit: actions, service and schema tests, plus a pgTAP test for any new table, policy or RPC.
- Use synthetic data only. Never log patient data or rate values.
- Update the plan's step checklist as steps complete. If you cannot make progress in two attempts, stop and ask.

Before completion: `npm run quality`; `supabase test db` and `npm run test:e2e` as AGENTS.md requires; exercise UI in a browser;
inspect `git diff` and `git diff --check`.

Report: files changed, behavior implemented, commands run with results (VERIFIED / UNVERIFIED (env) / ASSUMED), design
deviations (ADR link), unresolved risks.
