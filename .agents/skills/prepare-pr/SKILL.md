---
name: prepare-pr
description: Prepare the current verified branch for a pull request. Does not push or open the PR without approval.
disable-model-invocation: true
---

# Prepare Pull Request

Do not push or create a PR without explicit user approval.

Before preparing: run `git fetch && git rebase origin/main` (if `package-lock.json` conflicts, take main's and run `npm install --package-lock-only`; if your migration number collides, renumber your unmerged file), re-run `npm run quality` (and `supabase test db` for database work), run `scripts/work.sh overlap`, confirm the working tree is clean, tests and validation evidence exist, read the complete diff, and identify
breaking changes, **migrations (merging deploys them to production, and a bad one cannot be rolled back, only fixed forward)**,
changes to permissions or RLS, and unresolved risks. Confirm nothing sensitive is in the diff (the repository is public).

Prepare a descriptive, concise Conventional Commit-style PR title and a complete, ready-to-paste description. Read
`.github/pull_request_template.md` and `.github/PULL_REQUEST_TEMPLATE/` for applicable templates before drafting. Preserve
the chosen template's headings, comments, checklist items and order; fill its Issue, Areas touched and Migration number
with accurate details. Check checklist items only when verified. Include the summary, why, implementation, testing commands
and results, screenshots or other evidence, risks, rollback (Vercel rollback for the app; a forward-fix migration for the
database), follow-up work, and links to the plan and relevant ADRs as applicable. Explicitly identify checks not run and
do not invent evidence. Provide the title and description to the user; use them when creating or editing a PR only with
explicit approval. `CI ok` must pass before merge, including resolved review threads (`scripts/review-threads.sh <pr>`; use the
`address-pr-feedback` skill for review comments).
