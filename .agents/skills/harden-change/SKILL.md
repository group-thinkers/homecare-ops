---
name: harden-change
description: Simplify and harden an already-verified implementation without changing intended behavior.
---

# Harden Change

Only run after behavior has been verified.

Look for: unnecessary abstractions, duplicated logic, confusing naming, dead code, oversized functions, weak type boundaries (`as never`
casts that a registered `Database.Functions` entry would remove), poor error handling, N+1 queries, unbounded reads, accidental coupling
between services, and drift from the existing `patients` pattern.

Prefer simplification over abstraction. Do not expand feature scope. After changes: rerun all relevant verification, compare behavior
before and after, inspect the final diff.
