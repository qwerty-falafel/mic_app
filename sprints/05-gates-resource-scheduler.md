# Sprint 05 – Gates + Resource Scheduler

**Goal**: Add deterministic evidence‑based gates, bind them to repository revisions, and implement a resource‑aware scheduler that admits runs only when the model capability policy and system health thresholds are satisfied.

### Exit Criteria
Sprint ends when the **Gate & Scheduler Test Harness** validates that:
* All defined gates evaluate correctly against revision‑bound evidence.
* The scheduler admits or rejects runs based on the unified‑memory profile and model availability, without silently falling back to a weaker model.
* Michael can approve runs that are queued when resources become available.

---

### Discovery Tasks
1. **Evidence schema** – define a structured JSON schema for each deterministic evidence type (build log, test report, lint output, type‑check result, security scan). Include the associated git SHA.
2. **Gate definitions** – list required evidence per gate (e.g., `BUILD_PASS`, `TESTS_PASS`, `LINT_PASS`). Map each gate to a validator function that loads the JSON evidence and returns `pass`/`fail`.
3. **Revision binding** – design how an evidence record references a specific repository revision (`repo_id`, `commit_sha`). Ensure the `approvals` table also stores the same revision hash.
4. **Model capability policy** – from Sprint 01 profiling data, define capabilities (`coding`, `analysis`) and required quality tiers (`senior`, `standard`). Create a lookup table (`model_capabilities`) that maps capability + tier → concrete model ID.
5. **Resource admission control** – decide on concrete thresholds:
   - `MemAvailable` must stay > 200 MiB.
   - Unified‑memory usage of the model process must stay below 75 % of total RAM.
   - No swap activity.
   - Model load latency < 200 ms.
   - Active inference jobs are never pre‑empted; new jobs wait in the queue.
6. **Scheduler algorithm** – choose a simple priority queue (pg‑boss) where each job carries metadata (`priority`, `interactive`, `requiredCapability`). The scheduler reads the queue, checks the admission control, and dispatches via the adapters.

---

### Implementation Tasks
| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 1 | Add **evidence tables** (`evidence_records`) with JSONB column for the structured evidence and FK to `runs` and `repositories`. | Cline | Migrations succeed; evidence can be inserted and queried.
| 2 | Implement **gate validator module** (`src/gates/validator.ts`) that loads required evidence for a run, checks the JSON schema, and returns a boolean pass/fail. | Cline | Unit tests for each gate pass.
| 3 | Extend **approval schema** to include `artifact_revision` (git SHA) and `artifact_type`. | Cline | Approval record stores the hash; cannot be created without matching artifact.
| 4 | Build **model capability lookup** (`src/modelPolicy.ts`) using the data gathered in Sprint 01. Provide a function `selectModel(capability, tier)` that returns a model ID or throws if none available. | Cline | Returns correct model ID for known combos; throws on unknown.
| 5 | Create **resource monitor** (`src/services/resourceMonitor.ts`) that reads `/proc/meminfo`, queries the llama.cpp router for current model memory usage, and exposes a `canAcceptRun(runMeta)` predicate. | Cline | Predicate returns false when thresholds breached.
| 6 | Implement **Scheduler Service** (`src/services/scheduler.ts`):
   - Pull jobs from pg‑boss.
   - Use `canAcceptRun` to decide admission.
   - If admitted, resolve model via `selectModel` and dispatch to the appropriate execution adapter.
   - If not admitted, re‑queue with a delay.
   | Cline | Scheduler logs admission decisions; no job is started when resources insufficient.
| 7 | Write **Gate & Scheduler Test Harness** (integration tests) that:
   - Simulate a run with all required evidence → gate passes → scheduler admits.
   - Simulate missing evidence → gate fails → run stays in `BLOCKED` state.
   - Simulate low memory → scheduler rejects and re‑queues.
   | Cline | All scenarios pass; coverage ≥ 90 % for gate and scheduler code.
| 8 | Update **OpenAPI** with gate evaluation endpoint (`GET /runs/:id/gates`) and scheduler status endpoint (`GET /scheduler`). | Cline | Spec validates.

---

### Acceptance Criteria (overall)
* Evidence records are stored with explicit git SHA and validated against the JSON schema.
* Gate evaluation correctly determines pass/fail for each run.
* Scheduler only dispatches runs when the resource admission predicate is true and a suitable model is available.
* No silent model fallback – if a required capability is unavailable, the run remains queued with a clear status.
* Interactive runs are prioritized in the queue but never pre‑empt an already‑running inference job.
* All new API endpoints are documented and covered by tests.

### Dependencies
* **Sprint 01** – resource profiling data.
* **Sprint 02** – outbox and pg‑boss infrastructure.
* **Sprint 03** – execution adapters and run metadata.
* **Sprint 04** – full lifecycle producing runs and evidence.

### Review & Approval
* **Deliverable** – `docs/gates-and-scheduler.md`, updated schema migrations, scheduler implementation, gate validator, and the integration test suite.
* **Approval** – Michael reviews the design, runs the test harness, and signs off before Sprint 06.
