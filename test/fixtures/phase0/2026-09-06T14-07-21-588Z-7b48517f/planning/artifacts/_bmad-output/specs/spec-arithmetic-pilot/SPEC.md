---
id: SPEC-arithmetic-pilot
companions: []
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Arithmetic Pilot

## Why

Provide a lightweight, dependency‑free JavaScript module that offers basic arithmetic operations for finite numbers, enabling developers to include simple calculations in web projects without pulling in larger libraries or runtime overhead.

## Capabilities

- **CAP-1**
  - **intent:** Users can add two finite numbers with `add(a, b)` to obtain their sum.
  - **success:** `add(2, 3)` returns `5` and all test cases for addition pass.
- **CAP-2**
  - **intent:** Users can subtract one finite number from another with `subtract(a, b)` to obtain the difference.
  - **success:** `subtract(5, 2)` returns `3` and all subtraction tests pass.
- **CAP-3**
  - **intent:** Users can multiply two finite numbers with `multiply(a, b)` to obtain the product.
  - **success:** `multiply(4, 5)` returns `20` and all multiplication tests pass.
- **CAP-4**
  - **intent:** Users can divide one finite number by another with `divide(a, b)` to obtain the quotient, throwing a `RangeError` when the divisor is zero.
  - **success:** `divide(10, 2)` returns `5`; `divide(10, 0)` throws a `RangeError` and all division tests pass.

## Constraints

- The module must be a single ES module file (`arithmetic.js`) with no external dependencies.
- All operations must accept only finite numbers; non‑finite inputs are undefined behavior.
- `divide` must throw a `RangeError` when the divisor is zero.
- The implementation must not include any CLI, UI, persistence, or arbitrary‑precision arithmetic features.

## Non-goals

- Command‑line interface (CLI).
- Graphical user interface (UI) or visual components.
- Persistent storage or database integration.
- Arbitrary‑precision or big‑number arithmetic.
- Handling of non‑finite values (NaN, Infinity).

## Success signal

All four functions behave correctly for finite numbers, `divide` throws a `RangeError` on zero divisor, and the full test suite using `node:test` passes without failures.

## Assumptions

- The target runtime is a modern JavaScript environment (Node.js or browsers) that supports ES modules.

## Open Questions

- None.
