---
title: 'Export add function'
type: 'feature'
created: '2026-09-06'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The project lacks a reusable addition function for finite numbers, and there are no tests ensuring correct behavior across typical edge cases.

**Approach:** Implement `add(a, b)` in `arithmetic.js` that returns the sum of two finite numbers, exporting it via ES6 syntax. Add a Node.js test suite using `node:test` covering positive, negative, and zero operands, and verifying that non‑finite inputs throw a `TypeError`. No external dependencies are introduced.

## Boundaries & Constraints

**Always:**
- Use only built‑in JavaScript features.
- Accept only finite numbers; otherwise throw `TypeError`.
- Export the function for consumption by other modules.

**Never:**
- Use external packages or `BigInt`.
- Modify unrelated files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_POSITIVE | `add(2, 3)` | `5` | No error |
| HAPPY_PATH_NEGATIVE | `add(-4, -6)` | `-10` | No error |
| HAPPY_PATH_ZERO | `add(0, 0)` | `0` | No error |
| ERROR_NON_NUMBER | `add('a', 2)` | throws `TypeError` | Message: "Both arguments must be finite numbers."
| ERROR_INFINITE | `add(Infinity, 1)` | throws `TypeError` | Message: "Both arguments must be finite numbers."
| ERROR_NAN | `add(NaN, 2)` | throws `TypeError` | Message: "Both arguments must be finite numbers."

</intent-contract>

## Code Map

- `arithmetic.js` -- implements `add` and exports it.
- `test/arithmetic.test.js` -- Node.js test suite for the function.

## Tasks & Acceptance

**Execution:**
- `arithmetic.js` -- create file with `export function add(a, b) { ... }`.
- `test/arithmetic.test.js` -- create test file using `node:test` covering the matrix above.

**Acceptance Criteria:**
- Given two finite numbers, when `add` is called, then it returns their sum.
- Given a non‑finite or non‑number argument, when `add` is called, then it throws a `TypeError` with the specified message.
- All tests pass (`node test/arithmetic.test.js` exits with status 0).

## Spec Change Log

## Review Triage Log

## Design Notes

## Verification

**Commands:**
- `node test/arithmetic.test.js` -- expected: exit code 0 and all assertions pass.

**Manual checks (if no CLI):**
- Import `add` in a REPL and verify behavior for sample inputs.
