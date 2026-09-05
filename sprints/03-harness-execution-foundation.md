# Sprint 03 – Harness + Execution Foundation

> **Fast-track status (2026-09-05): combined with Sprint 04.** Worktree isolation, cancellable/recoverable OpenCode execution and durable BMAD-to-`RunResult` mapping are implemented and tested. A live successful Build Auto contract remains deferred until the first approved real execution; the adapter deliberately does not infer success from exit code alone.

**Goal**: Build the isolated work‑tree/branch manager, define the OpenCode harness adapter, and implement the BMAD *Direct* execution adapter that produces a **RunResult**. Capture the contracts discovered in Sprint 01 as test fixtures.

### Exit Criteria
Sprint ends when the **Execution Foundation Test Suite** passes and the contracts (artifact layout, status enums, blocked payload) are stored as version‑controlled fixtures.

---

### Discovery Tasks
1. **Worktree/branch strategy** – decide on a naming convention (`mic/<work‑item>/<story>/<run>`), whether to use detached HEAD or temporary branches, and how to clean up after run completion.
2. **OpenCode harness adapter design** – define the thin wrapper that starts an OpenCode session, forwards commands, captures stdout/stderr, and returns raw telemetry (model load time, inference latency, exit code).
3. **BMAD Direct adapter contract** – using the fixtures from Sprint 01, map the files produced by a successful Build Auto run to the fields of `RunResult`:
   - `status` (derived from BMAD status enum)
   - `artifactRefs` (paths to generated code, spec files, etc.)
   - `repositoryRevisions` (git SHA of the baseline and result)
   - `evidenceRefs` (test logs, lint output, etc.)
   - `blockingCondition` (populated when BMAD returns a blocked payload)
4. **Cancel / Recover semantics** – outline how a running job can be cancelled (SIGTERM) and how the system can recover a partially‑completed run (re‑read artifacts, update status).

---

### Implementation Tasks
| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 1 | Implement **Worktree Manager** (`src/worktree.ts`) that:
   - Clones the target repository into a temporary directory.
   - Checks out the baseline revision.
   - Creates an isolated branch/worktree per run.
   - Cleans up on success/failure.
   | Cline | `git worktree add` succeeds; directory removed after run.
| 2 | Build **OpenCode Harness Adapter** (`src/adapters/opencode.ts`) exposing `dispatch`, `observe`, `cancel`, `recover`. It should invoke OpenCode via its CLI, forward the chosen model ID, and capture telemetry. | Cline | `dispatch` returns a run identifier; `observe` returns raw telemetry JSON.
| 3 | Create **BMAD Direct Adapter** (`src/adapters/bmadDirect.ts`) that uses the Worktree Manager, runs `bmad build-auto` inside the worktree, and translates the on‑disk artifacts into a `RunResult`. | Cline | Successful run yields `status: "done"`; blocked run yields non‑empty `blockingCondition`.
| 4 | Add **RunResult type** (`src/types.ts`) matching the schema defined in the epic (status, artifactRefs, repositoryRevisions, evidenceRefs, blockingCondition, summary, rawAdapterState). | Cline | Type compiles; used by both adapters.
| 5 | Store **Phase‑0 fixtures** captured in Sprint 01 under `test/fixtures/phase0/` and write **contract tests** that feed those fixtures to the adapters and assert correct `RunResult` fields. | Cline | Tests pass on CI; fixtures are immutable.
| 6 | Implement **cancel** – send SIGTERM to the child process started by the adapter; ensure the worktree is left in a clean state. | Cline | Cancelled run records `status: "cancelled"`.
| 7 | Implement **recover** – given a run ID, re‑read the persisted artifacts, rebuild the `RunResult`, and resume any pending downstream actions. | Cline | Recoverable runs can be resumed after a process crash.
| 8 | Write **Execution Foundation Acceptance Tests** (Vitest) covering:
   - Successful Build Auto run.
   - Blocked Build Auto run.
   - Worktree creation and cleanup.
   - Cancel and recover flows.
   | Cline | All scenarios pass; coverage ≥ 90 % for the adapters.

---

### Acceptance Criteria (overall)
* Worktree manager creates isolated environments and cleans them up reliably.
* OpenCode adapter can start a session, forward a model ID, and return telemetry.
* BMAD Direct adapter correctly parses the real artifact layout discovered in Sprint 01 and produces a complete `RunResult`.
* Blocked conditions are captured as structured `blockingCondition` objects.
* Cancel and recover behaviours are deterministic and idempotent.
* All contracts are exercised by automated tests using the stored fixtures.

### Dependencies
* **Sprint 01** – provides the real artifact fixtures and blocked payload schema.
* **Sprint 02** – supplies the durable `runs` table where each run’s metadata will be persisted.

### Review & Approval
* **Deliverable** – `src/worktree.ts`, adapter implementations, `src/types.ts`, fixture directory, test suite, and updated OpenAPI components.
* **Approval** – Michael reviews the design, runs the acceptance tests, and signs off before Sprint 04 begins.
