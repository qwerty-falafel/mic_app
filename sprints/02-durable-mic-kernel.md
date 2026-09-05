# Sprint 02 – Durable MIC Kernel

> **Fast-track result (2026-09-05): implemented.** The critical integration test creates all core entity types, restarts the application/pool, reads the persisted state, processes committed outbox work with pg-boss, deliberately redelivers an event, and verifies one domain row, audit row, outbox row and consumer side effect. The former coverage percentage and exhaustive crash-matrix requirements are superseded by the fast-track acceptance rule.

**Goal**: Establish the persistent core of MIC – a PostgreSQL‑backed domain model, an **outbox dispatcher**, and a minimal command/query API. This sprint also introduces the durable entities required by later execution work (runs and questions).

### Exit Criteria
The sprint ends when the **Durable Kernel Acceptance Test Suite** passes and Michael signs off that the core state is restart‑safe and idempotent.

---

### Discovery Tasks
1. **Schema design** – define tables for:
   - `projects`
   - `repositories`
   - `work_items`
   - `runs`
   - `questions`
   - `audit_events`
   - `outbox_events`
   Include foreign‑key constraints and appropriate indexes.
2. **Outbox‑dispatcher model** – outline the flow:
   - Application writes a row to `outbox_events` inside the same transaction that updates domain state and audit.
   - A **dispatcher** reads undispatched rows, enqueues a pg‑boss job, and marks the row as `delivered` (idempotent key).
   - pg‑boss workers later consume the job.
3. **API contract** – specify the minimal set of HTTP endpoints (Fastify) needed to create projects, repositories, work items, runs and questions, and to query their current state.
4. **Restart & idempotency strategy** – decide how to recover from a crash mid‑transaction (test by killing the service after the domain update but before outbox insert).

---

### Implementation Tasks
| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 1 | Initialise a **TypeScript Fastify service** (`mic-service/`) with project scaffolding. | Cline | `npm run dev` starts without errors.
| 2 | Add **Drizzle** schema & migrations for the tables listed in Discovery 1. | Cline | `drizzle-kit migrate` produces clean SQL; migrations run on a fresh DB.
| 3 | Implement **transactional outbox** in the service layer: any state‑changing command creates an `outbox_events` row atomically with the domain update and audit record. | Cline | Simulated crash test leaves the domain state committed and the outbox row present.
| 4 | Build the **outbox dispatcher** (`src/dispatcher.ts`): reads undispatched rows, enqueues a pg‑boss job with a deterministic idempotency key, updates `delivered_at`. | Cline | Dispatcher can be restarted safely; duplicate dispatches are prevented.
| 5 | Wire **pg‑boss** workers that simply log the received job payload (real work will be added later). | Cline | Worker logs appear; job is removed from pg‑boss queue after success.
| 6 | Create **minimal Fastify routes** for:
   - `POST /projects`
   - `POST /projects/:id/repositories`
   - `POST /work-items`
   - `POST /runs`
   - `POST /questions`
   - `GET /projects/:id`, `GET /work-items/:id` etc.
   Each route validates input, writes via the outbox, and returns the created entity ID. | Cline | 200/201 responses; JSON matches schema.
| 7 | Write **Durable Kernel Acceptance Tests** (Vitest) that:
   - Create a work item, verify state persisted.
   - Crash the process after the domain update, ensure outbox row is still present.
   - Restart dispatcher, verify the job is eventually enqueued and processed.
   - Verify audit events are recorded for every state change.
   | Cline | All tests pass on CI; coverage ≥ 90 % for kernel code.
| 8 | Document the **API (OpenAPI)** and the outbox flow diagram. | Cline | `openapi.json` generated; flow diagram included in `docs/kernel-architecture.md`.

---

### Acceptance Criteria (overall)
* All core tables exist with correct constraints.
* A state change results in an `outbox_events` row and an `audit_events` row atomically.
* The dispatcher reliably moves undispatched rows into pg‑boss jobs exactly once.
* Restarting the service after a simulated crash leaves the domain state intact and the outbox job eventually processed.
* API endpoints behave as documented and are covered by tests.

### Dependencies
* Completion and sign‑off of **Sprint 01** (the Phase‑0 validation report).

### Review & Approval
* **Deliverable** – `docs/kernel-architecture.md`, the OpenAPI spec, migration scripts, and the test suite.
* **Approval** – Michael reviews the architecture diagram, runs the acceptance tests, and signs off before Sprint 03 begins.
