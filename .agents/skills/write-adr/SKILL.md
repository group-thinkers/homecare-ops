---
name: write-adr
description: Record an architecture decision as docs/decisions/ADR-NNN-*.md and update the index. Use when deviating from the spec or plan, or choosing among real alternatives.
---

# Write ADR

Create `docs/decisions/ADR-NNN-<slug>.md` (next free number) and add a row to `docs/decisions/README.md`.

Required sections: Status (Proposed / Accepted / Superseded) and date, Context, Decision, Alternatives, Consequences (positive and
negative), Revisit when. An ADR that deviates from the spec or plan names the section it amends and explains how the original goal
is preserved. Never edit an Accepted ADR's decision; supersede it. Product decisions (for example the open questions in
`docs/KNOWN_ISSUES.md`) are recorded here once the product lead decides.
