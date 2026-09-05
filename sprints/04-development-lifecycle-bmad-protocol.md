# Sprint 04 – Development Lifecycle + BMAD Protocol

**Goal**: Implement the full MIC lifecycle that mirrors the planning‑grade epic, including **DISCOVERY**, **PLANNING_GRADE**, **PLANNING_APPROVAL**, **TECHNICAL_DISCOVERY**, **IMPLEMENTATION_GRADE**, and **IMPLEMENTATION_APPROVAL**. Wire these stages to the execution adapters built in Sprint 03 and persist revision‑bound artifacts, approvals, and questions.

### Exit Criteria
The sprint ends when the **Lifecycle End‑to‑End Test Suite** demonstrates a complete vertical slice from intake to a successful Build Auto run, with both planning and implementation approvals recorded.

---

### Discovery Tasks
1. **Discovery workflow** – define what data the *DISCOVERY* step collects (e.g., repository mapping, dependency graph) and where it is stored (temporary `discovery_records` table).
2. **Planning‑grade execution** – using the BMAD Direct adapter, run a *planning* task (e.g., generate a PRD or specification) and capture the resulting artifact(s). Identify the artifact type (e.g., `planning.json`).
3. **Planning approval model** – design the `approvals` table entry that binds an approval to a specific artifact revision (`artifact_hash`, `artifact_type`).
4. **Technical discovery** – outline the additional data collection needed after planning approval (codebase analysis, risk assessment) and how it is persisted (`technical_records`).
5. **Implementation‑grade execution** – map the *implementation‑grade* package produced by BMAD (stories, tasks, acceptance criteria) to a set of runs that will be dispatched via the adapters.
6. **Implementation approval model** – similar to planning approval but bound to the implementation‑grade artifact revision.
7. **Blocked & question handling** – define how a `blockingCondition` from an adapter creates a `questions` record, and how answering the question triggers a state transition.

---

### Implementation Tasks
| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 1 | Extend the **domain schema** with tables:
   - `discovery_records`
   - `planning_artifacts`
   - `technical_records`
   - `implementation_artifacts`
   - `questions`
   - `approvals` (including `phase` column: `planning` or `implementation`). | Cline | Migrations create all tables with FK constraints.
| 2 | Implement **Lifecycle Service** (`src/services/lifecycle.ts`) that provides functions:
   - `intake(intent: string)` → creates a work item, stores raw intent.
   - `runDiscovery(workItemId)` → populates `discovery_records`.
   - `runPlanning(workItemId)` → invokes BMAD Direct adapter (planning mode), stores artifact, returns artifact hash.
   - `recordPlanningApproval(workItemId, artifactHash, approver)` → writes to `approvals` with `phase='planning'`.
   - `runTechnicalDiscovery(workItemId)` → additional analysis step.
   - `runImplementation(workItemId)` → dispatches Build Auto runs via the **BMAD Direct adapter** (implementation mode).
   - `recordImplementationApproval(...)` → similar to planning approval.
   | Cline | Each function updates state via the outbox and writes audit events.
| 3 | Add **state‑machine transitions** for the new phases in the outbox dispatcher (e.g., `INTAKE → DISCOVERY → PLANNING_GRADE → AWAITING_PLANNING_APPROVAL → TECHNICAL_DISCOVERY → IMPLEMENTATION_GRADE → AWAITING_IMPLEMENTATION_APPROVAL → IMPLEMENTING → GATE_VALIDATION → DONE`). | Cline | Invalid transitions are rejected with a clear error.
| 4 | Implement **question handling**:
   - When an adapter returns `blockingCondition`, create a `questions` row linked to the run.
   - Expose `POST /questions/:id/answer` which records the answer and triggers the appropriate state transition (e.g., back to `IMPLEMENTING`). | Cline | Question lifecycle is persisted and auditable.
| 5 | Ensure **revision‑bound persistence** – every artifact stored includes its git SHA (baseline and result) and is linked to the corresponding approval record.
| 6 | Write **Lifecycle End‑to‑End Tests** that simulate the entire flow:
   - Create a work item.
   - Run discovery, planning, obtain planning approval.
   - Run technical discovery.
   - Run implementation, capture a successful Build Auto run.
   - Record implementation approval.
   - Verify final state is `DONE` and all artifacts, approvals, and questions are stored with correct revision bindings.
   | Cline | Tests pass on CI; coverage ≥ 85 % for lifecycle code.
| 7 | Update **OpenAPI** with new endpoints for each lifecycle step and for question answering. | Cline | Spec validates.

---

### Acceptance Criteria (overall)
* All lifecycle tables exist and enforce referential integrity.
* Planning and implementation approvals are stored with explicit artifact hashes and cannot be altered.
* Blocked conditions generate a question record; answering the question moves the run forward.
* The end‑to‑end test demonstrates a complete vertical slice from intent to `DONE` using real adapters and the fixtures from Sprint 01.
* All new API endpoints are documented and covered by tests.

### Dependencies
* **Sprint 01** – provides the real BMAD contracts and blocked payload schema.
* **Sprint 02** – core outbox and API infrastructure.
* **Sprint 03** – execution adapters and run management.

### Review & Approval
* **Deliverable** – `docs/lifecycle-architecture.md`, updated schema migrations, service implementation, OpenAPI spec, and the end‑to‑end test suite.
* **Approval** – Michael reviews the architecture, inspects the test run, and signs off before Sprint 05.
