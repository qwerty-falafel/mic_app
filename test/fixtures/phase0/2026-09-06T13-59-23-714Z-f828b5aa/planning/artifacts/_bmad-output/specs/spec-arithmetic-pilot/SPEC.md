---
id: SPEC-arithmetic-pilot
companions: []
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Arithmetic Pilot

## Why

Provide a lightweight, dependency‑free JavaScript ES module offering basic arithmetic operations for finite numbers, enabling developers to perform calculations without pulling in external libraries.

## Capabilities

- **CAP-1**
  - **intent:** provide `add(a,b)` returning `a+b` for finite numbers.
  - **success:** unit tests verify `add` returns correct sum for finite numbers.
- **CAP-2**
  - **intent:** provide `subtract(a,b)` returning `a-b` for finite numbers.
  - **success:** unit tests verify `subtract` returns correct difference for finite numbers.
- **CAP-3**
  - **intent:** provide `multiply(a,b)` returning `a*b` for finite numbers.
  - **success:** unit tests verify `multiply` returns correct product for finite numbers.
- **CAP-4**
  - **intent:** provide `divide(a,b)` returning `a/b` for finite numbers, throwing `RangeError` on zero divisor.
  - **success:** unit tests verify `divide` returns correct quotient for non‑zero divisor and throws `RangeError` when divisor is zero.

## Constraints

- Must be dependency‑free and implemented as a pure ES module compatible with Node.js LTS.

## Non-goals

- CLI interface
- User interface (UI)
- Persistence
- Arbitrary precision arithmetic

## Success signal

All unit tests written with `node:test` pass, and the module can be imported and used in a Node.js LTS environment without errors.
