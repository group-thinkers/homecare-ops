# Require resolved PR review threads in CI + address-pr-feedback skill

- **Issue:** #84 (claimed by @apello; confirmed with `scripts/work.sh check 84`)
- **Owner:** @apello
- **Branch:** `ci/84-review-thread-gate`
- **Status:** Completed (2026-11-22)
- **Areas touched:** `.github/workflows/ci.yml`, `scripts/review-threads.sh`, `.agents/skills/`, `docs/` (RULES, WORKFLOW, decisions), `ARCHITECTURE.md`, `AGENTS.md`
- **Migration number claimed:** none
- **Spec / plan refs:** ADR-001 (CI ok), ADR-003 (this decision)

## Outcome
`CI ok` fails while a pull request has unresolved review threads; agents have a skill to read, fix, answer, resolve and re-run.

## Non-Goals
Branch protection changes ("require conversation resolution"); fixing PR #83's five open threads (separate fix branch with migration 00019).

## Decisions
- Count every unresolved thread, outdated included (ADR-003).
- Job runs after the other CI jobs; passes on push and dispatch. Resolving does not trigger CI: re-run failed jobs.

## Acceptance Criteria
- [x] `scripts/review-threads.sh 83 --check` lists 5 unresolved threads and exits 1; `--count` prints 5; PR #65 exits 0; bad input exits 2.
- [x] `ci.yml`: `review-threads` job (pull-requests: read) is in `ci-ok` needs; YAML valid (`npx yaml valid`).
- [x] `.agents/skills/address-pr-feedback/SKILL.md` exists; referenced from AGENTS.md, RULES.md, prepare-pr, ADR-003.
- [x] `npm run quality` passes (lint, typecheck, unit, build).
- [ ] CI run on the PR: `review threads resolved` job passes with no threads (UNVERIFIED until pushed; actionlint not installed locally).

## Ordered Steps
- [x] 1. Script  - [x] 2. CI job  - [x] 3. Skill  - [x] 4. Docs + ADR  - [ ] 5. Quality, commit, PR (with approval)

## Progress log
- 2026-11-22: implemented script, CI job, skill, ADR-003 and docs. Next: quality, commit, push/PR after approval.
