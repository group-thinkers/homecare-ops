## What and why

<!-- One or two sentences. -->

- **Issue:** closes #
- **Areas touched:** <!-- folders; note shared files: src/types/index.ts, nav, docs/DATABASE.md -->
- **Migration number:** <!-- 00NNN, or none -->

## Checklist

- [ ] Rebased on `main`; `npm run quality` passes locally
- [ ] If `supabase/migrations/` changed: new file only (no edits to merged ones), RLS and grants covered, `supabase test db` passes, `docs/DATABASE.md` updated
- [ ] No secrets, `.env` values or real data in the diff
