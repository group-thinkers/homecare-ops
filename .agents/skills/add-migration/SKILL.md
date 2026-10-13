---
name: add-migration
description: Checklist for any database change - migration file, RPC, policy, grants, tests, docs. Production applies migrations automatically on merge.
---

# Add a Migration

Merging to `main` applies new files in `supabase/migrations/` to production (`supabase-migrate.yml`). Migrations are append-only (INV-4).

1. Number: the next free `000NN_snake_case.sql` (check `ls supabase/migrations` AND open PRs with `scripts/work.sh board`; the plan's numbers are stale). Record it in your plan's header. If it collides after a rebase, renumber your unmerged file. CI (`migration-order`, `scripts/check-migrations.sh`) fails duplicates, gaps and edits of merged migrations. Never edit or renumber a migration on `main`; fix forward. A truly justified edit needs a line (file name and reason) in `supabase/migration-edits.allow` in the same PR.
2. Write it using the template in the cheatsheet (`scripts/doc.sh cheat "Migrations"`): header comment, `security definer` + `set search_path = public`,
   permission check via `has_org_permission` first, explicit enum validation, `auth.uid()` for actor columns (never a client-supplied user id),
   and `revoke all … from public; grant execute … to authenticated;` with the full argument type list.
3. New tables: `organization_id`, composite FKs, `enable row level security` in the same file, policies `to authenticated` using `has_org_permission`,
   no DELETE policy (soft delete). Append-only tables are written only inside RPCs.
4. Money, PHI and credentials: separate permission, never in list projections, never in operational events.
5. Reference data uses `insert … on conflict … do update` so re-runs are idempotent.
6. Add a pgTAP test in `supabase/tests/database/` for every new table, policy and RPC: allowed role works, other role/other organization/anon fail.
7. Apply from scratch: `supabase start`, `supabase test db`. Each file runs in a transaction.
8. Register new RPCs in `Database.Functions` in `src/types/index.ts`; add enums/row types; remove `as never` casts you no longer need.
9. Update `docs/DATABASE.md` in the same commit (§6 inventory, §10, "Applied through", policies).
10. State the rollback story in the PR: forward-fix migration only.
