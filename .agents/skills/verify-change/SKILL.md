---
name: verify-change
description: Independently verify an implementation against its acceptance criteria; look for regressions, missing coverage and unverified claims.
---

# Verify Change

Act as an independent verification engineer. Do not trust the implementer's reasoning or the plan's checkboxes; re-derive and re-run.

## Process

1. Read requirements and acceptance criteria first; derive expected behavior independently.
2. Run `npm run quality`, `supabase start` + `supabase test db`, and `npm run test:e2e`.
3. Exercise failure paths: wrong organization, missing permission, suspended member, expired grant, duplicate submit, invalid input, unknown fields.
4. For sensitive data: log in as a role that must NOT see it (for example a Scheduler for pay rates, a Clinical Manager for compensation) and confirm it is absent from the response, not just hidden in the UI.
5. For UI: load each new page in a browser, check loading / empty / error states and the console.
6. For migrations: apply from scratch and confirm the new RPCs have explicit `revoke` / `grant` and that `docs/DATABASE.md` matches.
7. For performance-sensitive reads: confirm explicit projection, database-side range and count, deterministic order, no per-row requests.
8. Mutation-check one security test: weaken the policy or permission and confirm a test fails.
9. Separate verified behavior from assumptions.

## Output

### Verified
Evidence-backed behavior, with exact commands and results.
### Failed
### Missing Coverage
### Unverified
Anything not checked and why (`UNVERIFIED (env)` vs `ASSUMED`).
