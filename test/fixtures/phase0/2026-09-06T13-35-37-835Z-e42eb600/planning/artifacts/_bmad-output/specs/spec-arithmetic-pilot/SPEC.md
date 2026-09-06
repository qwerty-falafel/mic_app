---
id: SPEC-arithmetic-pilot
companions: []
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Arithmetic Pilot

## Why

Provide a lightweight, dependency‑free JavaScript ES module offering basic arithmetic operations for use in web and Node environments.

## Capabilities

- **CAP-1**
  - **intent:** User can perform basic arithmetic operations (add, subtract, multiply, divide) on finite numbers via a dependency‑free JavaScript ES module.
  - **success:** Functions return correct results and `divide` throws `RangeError` for zero divisor, verified by a `node:test` suite.

## Constraints

- Must be a dependency‑free JavaScript ES module.
- Must operate only on finite numbers.
- Must not include CLI, UI, persistence, or arbitrary‑precision features.

## Non-goals

- Provide a CLI, UI, persistence layer, or arbitrary‑precision arithmetic.

## Success signal

- All `node:test` suite cases pass, confirming correct results and proper `RangeError` on zero divisor.

## Assumptions

- Input numbers are finite JavaScript numbers.

## Open Questions

- _None._