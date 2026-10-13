---
name: prepare-pr
description: Prepare the current verified branch for a pull request. Does not push or open the PR without approval.
disable-model-invocation: true
---

# Prepare Pull Request

Do not push or create a PR without explicit user approval.

Before preparing: confirm the working tree is clean, tests and validation evidence exist, read the complete diff, and identify
breaking changes, **migrations (merging deploys them to production, and a bad one cannot be rolled back, only fixed forward)**,
changes to permissions or RLS, and unresolved risks. Confirm nothing sensitive is in the diff (the repository is public).

Produce: Summary, Why, Implementation, Testing (commands and results), Screenshots / Evidence, Risks, Rollback (Vercel rollback for
the app; a forward-fix migration for the database), Follow-up Work. Link the plan and ADRs. `CI ok` must pass before merge.
