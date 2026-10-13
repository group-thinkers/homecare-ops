# MIGRATIONS.md — Git-driven Supabase migrations

Goal: **you never paste SQL into the Supabase dashboard again.** A migration file lands in `supabase/migrations/`,
you push to `main`, GitHub Actions runs `supabase db push`, the hosted DB is updated.

Files involved:
- `supabase/migrations/000NN_*.sql` — the migrations (already 12 exist, all applied manually so far)
- `supabase/config.toml` — created by `supabase init` (commit it)
- `.github/workflows/supabase-migrate.yml` — the CI job (already written)
- `docs/DATABASE.md` — human-readable source of truth; update in the same commit as the migration

---

## 1. One-time setup (≈15 minutes)

### 1.1 Install the CLI locally

```bash
brew install supabase/tap/supabase      # macOS
supabase --version
```

### 1.2 Initialise the project folder and link to the hosted project

```bash
cd homecare-ops
supabase init                            # creates supabase/config.toml (keeps existing migrations/ folder)
supabase login                           # opens browser, stores an access token locally
supabase link --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` is the 20-char id in your dashboard URL: `https://supabase.com/dashboard/project/<PROJECT_REF>`.
You will be prompted for the **database password** (Dashboard → Project Settings → Database). Save it in a password manager; CI needs it too.

### 1.3 Baseline: tell the remote it already has 00001–00012

The remote DB has all 12 migrations applied by hand but has no record of them in `supabase_migrations.schema_migrations`. Without a baseline, `db push` would try to re-run `00001` and fail.

```bash
# Check what the remote thinks (expect: Remote column empty for all 12)
supabase migration list

# Mark each existing migration as applied WITHOUT running it
supabase migration repair --status applied 00001 00002 00003 00004 00005 00006 00007 00008 00009 00010 00011 00012

# Verify: Local and Remote columns should now both list 00001–00012
supabase migration list

# Sanity check: no pending migrations, nothing to push
supabase db push --dry-run
```

If `migration list` shows remote versions you don't have locally (e.g. from the dashboard's own migration tooling), run
`supabase migration repair --status reverted <version>` for those.

### 1.4 Un-ignore the supabase folder and commit

`.gitignore` already ignores `/supabase/seed/` (plaintext passwords). Nothing else under `supabase/` is ignored, but the folder was never committed.

```bash
git add supabase/config.toml supabase/migrations .github/workflows/supabase-migrate.yml docs/
git commit -m "chore(db): track migrations and add push-to-migrate workflow"
```

Confirm `supabase/.temp/` and `supabase/.branches/` are **not** staged — `supabase init` adds them to `.gitignore` automatically; if not, add:

```
/supabase/.temp/
/supabase/.branches/
```

### 1.5 GitHub secrets

Repo → Settings → Secrets and variables → Actions → **New repository secret** (or under an environment named `production`, which the workflow uses):

| Secret | Where to get it | Authorizes |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens → Generate new token, name it `github-actions-homecare-ops` | `supabase link` + `migration list` (Management API) |
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → Database → Database password (reset it if you don't have it) | the actual `db push` — **direct Postgres access; the highest-risk secret here** |
| `SUPABASE_PROJECT_ID` | the `<PROJECT_REF>` from 1.2 | nothing; it's public (it's in your dashboard URL) |

**On access-token permissions:** Supabase personal access tokens have **no scope picker** — the only field is a name. The token inherits your user account's access to every organization and project you belong to, and the value is displayed once (hashed afterwards), so copy it immediately. Revoke from the same page at any time.

The only way to limit a PAT is to mint it from a lower-privileged account: create a second Supabase account (`you+ci@…`), invite it to the org as **Developer** (Owner/Administrator/Developer are available on Free; Read-Only and project-scoped roles require Team/Enterprise), and generate the token there — that token can't delete the project or touch billing. Not required for MVP (private repo, synthetic data only).

**Pre-go-live hardening (add to the HIPAA readiness checklist):** rotate both secrets, switch to a dedicated CI account, and enable required reviewers on the `production` GitHub environment.

The workflow declares `environment: production`. Create that environment in Settings → Environments (you can add "required reviewers" later if you want a manual approval gate before migrations run). If you'd rather not use environments, delete the `environment:` line and store the secrets at repo level.

### 1.6 First CI run

Push the commit from 1.4. The workflow triggers only when `supabase/migrations/**` changes, so it will run (the migrations are new to git). Since the remote is baselined, `db push` logs "Remote database is up to date." — that's the success signal. Also runnable manually: Actions → Supabase migrations → Run workflow.

---

## 2. Day-to-day flow (every phase)

```bash
# 1. Create the file — the CLI uses timestamps; rename to match the sequential convention
supabase migration new caregiver_rpcs
mv supabase/migrations/<timestamp>_caregiver_rpcs.sql supabase/migrations/00013_caregiver_rpcs.sql

# 2. Write SQL (template in docs/IMPLEMENTATION_CHEATSHEET.md §2)

# 3. Test against the hosted DB BEFORE pushing (optional but recommended)
supabase db push --dry-run          # shows exactly which files would run
supabase db push                    # applies 00013 to the hosted DB right now

# 4. Update docs/DATABASE.md (§6, §10, "Applied through") and src/types/index.ts

# 5. Commit + push → CI re-runs db push, sees 00013 already applied, no-ops.
git add supabase/migrations/00013_caregiver_rpcs.sql docs/DATABASE.md src/types/index.ts
git commit -m "feat(caregivers): add caregiver RPCs migration"
git push
```

If you skip step 3, CI applies the migration on push — equally fine; that's the whole point. Step 3 just gives you a faster failure loop.

**Version naming:** Supabase treats the leading digits before the first `_` as the version. `00013` sorts after `00012`, so sequential zero-padded names keep working. Never reuse or renumber a version once it has been pushed.

**Never edit a migration that has been applied.** Write a new one (`00014_fix_…`). Rollback = forward-fix migration (matches `implementation-plan.md` §15).

---

## 3. Local Postgres (optional, for agents to test SQL without touching the hosted DB)

```bash
supabase start                      # Docker; spins up local Postgres + applies all migrations from scratch
supabase db reset                   # wipe + re-apply all migrations + run supabase/seed.sql if configured
supabase stop
```

Point `.env.local` at the local API URL/keys printed by `supabase start` when you want to run the app against it.
Because `supabase/seed/` is git-ignored, set `[db.seed] sql_paths = ["./seed/reset.sql", "./seed/seed.sql"]` in `config.toml` only on your machine, or leave seeding manual.

---

## 4. Keeping `docs/DATABASE.md` honest — schema dump

After any deploy, regenerate a machine dump and diff it against the doc:

```bash
supabase db dump --linked -f supabase/schema.sql        # public schema DDL + policies + functions
git diff supabase/schema.sql                            # anything unexpected?
```

Add to `package.json`:

```json
"db:dump": "supabase db dump --linked -f supabase/schema.sql",
"db:push": "supabase db push",
"db:status": "supabase migration list"
```

Commit `supabase/schema.sql` — it's the mechanical source of truth; `docs/DATABASE.md` is the annotated one.

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| `db push` wants to apply 00001 | Baseline missed — run §1.3 `migration repair --status applied …` |
| `relation already exists` | Same as above, or someone ran SQL manually. Repair that version as applied. |
| CI: `failed to connect` / password error | `SUPABASE_DB_PASSWORD` wrong; reset in dashboard and update the secret |
| CI: `Access token not provided` | `SUPABASE_ACCESS_TOKEN` missing or not exposed to the `production` environment |
| Remote has a version local lacks | `supabase migration repair --status reverted <version>` (only if you're sure it was a dashboard artefact) |
| Migration failed halfway | Each file runs in a transaction — the DB is unchanged. Fix the SQL, push again. |
| Need to see what ran | Dashboard → Database → Migrations, or `supabase migration list` |
