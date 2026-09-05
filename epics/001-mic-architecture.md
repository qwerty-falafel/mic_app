# Epic: MIC Control Plane + BMAD Development System

**Status:** Planning‑grade — architecture candidate pending planning approval and Phase 0 validation

**Date:** 2026‑09‑03

**Owner:** Michael

**System:** MIC — Morgan's Intelligent Control

**Development protocol:** BMAD Method

**Primary coding harness:** OpenCode

**Local model plane:** llama.cpp router on `127.0.0.1:10000`

**Purpose of this document:** Define what MIC must do, what BMAD must do, the user‑visible behavior, requirements, major implementation ideas, risks, and validation gates. This document is *not* implementation approval.

---

## 1. Epic Objective

Build MIC as the persistent control plane for a small AI software‑development organization.

Michael acts as product owner/founder. MIC manages projects, work, approvals, durable state, agents, models, evidence, scheduling and user interaction. BMAD provides the software‑development method inside that system: discovery, planning, specification, implementation, review and retrospective.

**Architectural boundary**

- **MIC** owns the company.
- **BMAD** owns the software‑development method used by the company.

MIC should not recreate BMAD's planning, story‑writing, development or review prompts. Conversely, BMAD should not become responsible for cross‑project scheduling, approvals, resource management, persistent organizational state, user interfaces or infrastructure.

This preserves the strongest idea in the previous implementation plan: MIC remains a control plane rather than becoming another monolithic coding agent.

---

## 2. Product Vision

Michael should eventually be able to say something like:

> “I want Parliament People to support X.”

and have MIC turn that intent into a managed development program.

MIC should determine what project and repositories are involved, conduct discovery, invoke BMAD to produce planning‑grade artifacts, bring the plan to Michael for approval, perform technical discovery and hardening, produce an implementation‑grade package, ask Michael for implementation approval, and then supervise implementation through disposable coding‑agent sessions.

Michael should be able to close the application, reboot the workstation, leave for several hours, or switch projects without losing organizational state.

The system should behave more like a **company operating system** than an IDE chat.

---

## 3. Product Principles

### 3.1 Durable state is separate from agent context

- No important organizational fact may exist only inside an LLM conversation.
- Agent sessions are disposable.
- Projects, work items, approvals, questions, evidence, execution status and resource allocations are durable.

### 3.2 Waiting humans consume no inference

- When MIC needs Michael's approval or a genuine product decision, execution stops cleanly.
- There is no suspended LLM context that must remain resident.
- The state is persisted, the model becomes available for other work, and a fresh agent session continues after the decision.

### 3.3 Fresh‑context workers

- A build/review/research session should receive the smallest sufficient typed hand‑off plus references to durable artifacts.
- Large accumulated conversations are an implementation smell.
- BMAD's Build Auto model already follows this principle: each invocation owns one session‑sized unit while an external orchestrator owns backlog and dispatch policy.

### 3.4 Evidence over agent claims

A worker saying *“done”* is insufficient. MIC should prefer:

- repository state;
- commits and diffs;
- test output;
- build output;
- lint/type‑check output;
- BMAD machine‑readable status;
- independent review;
- explicit approval records.

### 3.5 Git owns versioned artifacts; Postgres owns orchestration state

There is not one universal “source of truth.”

- Git repositories are authoritative for versioned product artifacts and implementation.
- Postgres is authoritative for MIC's organizational and orchestration state.

### 3.6 Human involvement is reserved for consequential decisions

Routine queueing, retries, model loading, indexing, status tracking, test execution and safe recovery should not ask Michael for permission.

Human gates exist for product/implementation approval, exceptional risk, credentials/MFA, dangerous operations and genuine ambiguity.

---

## 4. Scope

### In scope

MIC v1 should provide:

- multi‑project management;
- multi‑repository projects;
- durable work‑item lifecycle;
- BMAD planning and implementation orchestration;
- explicit planning and implementation approval gates;
- technical‑discovery/hardening phase between those gates;
- OpenCode harness execution;
- bmad‑build‑auto integration;
- optional bmad‑loop execution of approved epics;
- git worktree isolation;
- durable queue/retries;
- local model routing and scheduling;
- deterministic gates;
- AI review;
- artifact/provenance indexing;
- questions and blocked‑run handling;
- PWA control interface;
- run/model/queue telemetry;
- restart recovery;
- audit history.

Existing planning already correctly identifies MIC's durable state, queue, model scheduling, approvals, UI and cross‑project coordination as responsibilities BMAD should not own.

### Deferred / secondary scope

These should remain compatible with the architecture but need not block the first useful MIC:

- voice;
- n8n integrations;
- TEA;
- public remote access;
- non‑software LangGraph workflows;
- autonomous deployment;
- advanced memory/RAG;
- cellular/SMS interfaces.

---

## 5. Architecture

```
                         MIC PWA
                conversation / status / approvals
                            │
                            ▼
                    MIC CONTROL API
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
         PostgreSQL     Transactional    Event / SSE
        domain state       Outbox          stream
             │              │
             │              ▼
             │          pg-boss
             │              │
             └───────┬──────┘
                     ▼
                MIC Scheduler
                     │
            ┌────────┴────────┐
            ▼                 ▼
      Resource Router     Harness Runner
      model / slots /          │
      concurrency              │
            │             ┌────┴────────────┐
            │             ▼                 ▼
            │       BMAD Adapter      bmad-loop Adapter
            │             │                 │
            │             └──────┬──────────┘
            │                    ▼
            │                 OpenCode
            │                    │
            └────────────────────┤
                                 ▼
                         llama.cpp router
                          127.0.0.1:10000
```

The existing plan's decision to demote LangGraph and use Postgres + queue + fresh sessions is retained. LangGraph remains an optional future worker technology for workflows that genuinely require persistent multi‑step graph semantics. It is not part of the core software‑development lifecycle.

---

## 6. MIC Product Lifecycle

The planning‑grade lifecycle is therefore:

```
INTAKE
  │
  ▼
DISCOVERY
  │
  ▼
PLANNING_GRADE
  │
  ▼
AWAITING_PLANNING_APPROVAL
  │
  ▼
TECHNICAL_DISCOVERY
  │
  ▼
IMPLEMENTATION_GRADE
  │
  ▼
AWAITING_IMPLEMENTATION_APPROVAL
  │
  ▼
IMPLEMENTING
  │
  ▼
GATE_VALIDATION
  │
  ├──────────────► BLOCKED
  │
  ▼
AWAITING_ACCEPTANCE   (optional by policy)
  │
  ▼
DONE
```

*BLOCKED* is not a failure; it indicates autonomous execution cannot safely decide what happens next. A resolved blocked item returns to the appropriate previous lifecycle stage rather than automatically returning to INTAKE.

---

## 7. Lifecycle Responsibilities

### INTAKE

MIC captures raw intent and identifies:

- product/project;
- relevant repositories;
- source of request;
- initial scope;
- urgency;
- obvious dependencies.

No implementation is attempted.

### DISCOVERY

MIC/BMAD investigate the product problem sufficiently to understand what is being requested. This may involve existing documentation, repository analysis, prior decisions and targeted questions.

**Deliverable:** a discovery record and clear intent.

### PLANNING_GRADE

BMAD produces the appropriate planning artifacts for the size of the request. Small work may require a focused specification; larger work may require PRD, UX and architecture artifacts before decomposition into epics/stories.

**Deliverable:** something Michael can meaningfully approve as what should be built and why.

### AWAITING_PLANNING_APPROVAL

No worker runs. Michael may approve, reject, request changes, or answer open questions. Approval records the exact artifact revisions approved.

### TECHNICAL_DISCOVERY

The approved product direction is investigated from an implementation perspective. Activities may include code‑base mapping, dependency/API investigation, data migration analysis, test strategy, security implications, operational implications, integration boundaries, story dependency analysis, prototype/spike work where justified.

### IMPLEMENTATION_GRADE

BMAD/MIC convert approved planning into a technically hardened execution package. It must identify stories/tasks, repository ownership, dependencies, acceptance criteria, test expectations, integration strategy, risks and required gates.

### AWAITING_IMPLEMENTATION_APPROVAL

Michael approves execution of this implementation approach. Nothing should start before approval.

### IMPLEMENTING

MIC dispatches bounded workers. A story may be handled by direct **bmad‑build‑auto**, while an already‑approved ordered epic may be delegated to **bmad‑loop**. BMAD explicitly defines Build Auto as a single unattended unit rather than a backlog scheduler.

### GATE_VALIDATION

Deterministic evidence runs first; AI review follows where useful. Potential evidence includes build, tests, lint, type‑check, migration validation, security checks, BMAD review, optional TEA, smoke tests.

### AWAITING_ACCEPTANCE (optional)

Projects may configure this gate for changes Michael wants to inspect personally. Routine low‑risk approved work should eventually proceed without a third mandatory approval.

### DONE

Product state, artifacts, audit history and resulting commits are indexed. Retrospective/learning may be generated without reopening the implementation lifecycle.

---

## 8. BMAD's Role

BMAD is MIC's adopted software‑development protocol. BMAD should own:

- product planning workflows;
- specifications;
- architecture/UX artifacts where appropriate;
- story decomposition;
- implementation method;
- code review method;
- retrospective;
- project‑specific BMAD skills/configuration.

MIC should invoke BMAD, not fork its core workflows. BMAD Build Auto currently relies on subagents; if the harness cannot provide them, it intentionally halts blocked with no subagents. This must therefore be proven during Phase 0, not treated as an assumption.

---

## 9. MIC's Role

MIC owns everything around a BMAD execution:

- project registry;
- repository registry;
- work‑item lifecycle;
- cross‑project backlog;
- dependencies;
- priorities;
- approvals;
- questions;
- user interaction;
- queueing;
- retries;
- concurrency;
- model scheduling;
- worktree lifecycle;
- security policy;
- artifact indexing;
- evidence;
- gates;
- provenance;
- notifications;
- recovery;
- audit.

MIC never asks BMAD to become the organizational database.

---

## 10. Multi‑Repository Project Model

A **Project ≠ Repository**. A project owns one or more repositories.

```
Project
└── Parliament People
    ├── planning
    │   └── parliament_people_product_development
    ├── application
    │   └── parliament_people_app
    └── infrastructure   (optional)
```

### Conceptual entities

- Project
- Repository
- ProjectRepository
- WorkItem
- Story
- Run
- RunRepository
- Artifact
- Evidence
- Gate
- Approval
- Question
- AuditEvent
- OutboxEvent
- ModelSchedule

### ProjectRepository.role (initial)

- planning
- application
- infrastructure
- deployment
- documentation
- other

### RunRepository fields (per repository touched by a run)

- repository_id
- worktree_path
- baseline_revision
- result_revision
- branch

This makes cross‑repository work auditable without pretending that one revision describes an entire project.

---

## 11. Artifact and Revision Contract

Every material artifact should identify:

- owning project;
- owning repository (where applicable);
- path;
- revision;
- generating run;
- artifact type;
- relationship to a work item/story.

An approval therefore means **“Michael approved artifact X at revision Y.”** not merely “Michael approved work item 123.”

Likewise, evidence must be bound to the exact code revision it validated. A test result from revision A must never accidentally satisfy a gate for revision B.

---

## 12. Execution Adapter Architecture

Define a normalized MIC abstraction:

```ts
interface ExecutionAdapter {
  dispatch(run: Run): Promise<void>;
  observe(run: Run): Promise<RunResult>;
  cancel(run: Run): Promise<void>;
  recover(run: Run): Promise<void>;
}
```

### Conceptual RunResult

- status
- blockingCondition
- summary
- artifactRefs[]
- repositoryRevisions[]
- evidenceRefs[]
- followupRecommended
- rawAdapterState

#### BMAD Direct Adapter

Observes BMAD's durable spec/story artifact. BMAD contract exposes statuses: draft, ready‑for‑dev, in‑progress, in‑review, done, blocked.

#### bmad‑loop Adapter

Uses its own orchestration state and `result.json`. The contract remains isolated inside the adapter.

#### OpenCode Adapter

Supplies session/process/tool telemetry. A zero exit code is *not* sufficient evidence of success; semantic success comes from the development adapter and evidence.

---

## 13. Worktree and Branch Model

Every implementation run must have an isolated execution environment.

```
run_id
│
├── unique branch or detached base
└── unique worktree
```

A run should begin from a recorded immutable baseline. The runner must not attach multiple worktrees to the same normal branch in conflicting ways.

**Suggested branch naming (example):** `mic/<work-item>/<story>/<run>`

Integration into the project branch occurs only after gates and applicable approval policy are satisfied.

---

## 14. Queue and Durability

Previous sequence left a crash window. Use a **transactional outbox**:

```
BEGIN
  update domain state
  insert audit event
  insert outbox event
COMMIT
```

A dispatcher then delivers the outbox event to **pg‑boss**. All dispatched work has an idempotency key, guaranteeing no lost or duplicated steps across crashes.

---

## 15. Model and Resource Scheduling

The local model plane provides a starting point:

- llama.cpp router at `127.0.0.1:10000`
- models‑preset
- `--models-max 1`

MIC should manage model requirements, not hard‑code a permanent model. A work unit declares capabilities, e.g.:

```
capability = coding
quality_tier = senior
context_requirement = high
vision_required = false
```

The model router resolves this into the best currently approved model.

### Resource rules

- Never unload a model that is serving an active request.
- Prefer batching queued work that uses the same model.
- Switch models between runs rather than during one.
- Maintain workstation memory headroom.
- Measure actual resident memory rather than assuming model file size equals runtime usage.
- Interactive Michael work outranks unattended batch work.
- Large overnight work may use a separate resource policy.

The model selector should use the same llama.cpp catalogue already used by Cline/Open WebUI.

---

## 16. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR‑01 | Project Registry – MIC shall register a product/project independently of its repositories. |
| FR‑02 | Repository Registry – MIC shall associate multiple repositories with a project and assign each a role. |
| FR‑03 | Intake – Michael shall be able to create a work item from natural‑language intent. |
| FR‑04 | Durable Lifecycle – Every work item shall occupy exactly one durable MIC lifecycle state. |
| FR‑05 | Planning Grade – MIC shall invoke the appropriate BMAD planning path and index the resulting planning artifacts. |
| FR‑06 | Planning Approval – MIC shall halt before technical hardening until Michael approves the planning‑grade artifact set. |
| FR‑07 | Technical Discovery – MIC shall support technical investigation after planning approval and before implementation approval. |
| FR‑08 | Implementation Grade – MIC shall produce/index an execution‑ready package containing stories, dependencies, acceptance criteria and gates. |
| FR‑09 | Implementation Approval – MIC shall prohibit implementation until the approved implementation‑grade artifact revisions are recorded. |
| FR‑10 | Worker Dispatch – MIC shall dispatch a bounded implementation unit into an isolated harness session. |
| FR‑11 | BMAD Build Auto – MIC shall support direct execution of one BMAD Build Auto work unit. |
| FR‑12 | bmad‑loop – MIC shall optionally dispatch an approved ordered epic through a pinned bmad‑loop version. |
| FR‑13 | Blocked Work – A blocked worker shall produce a durable blocking condition and route to MIC rather than blindly retry. |
| FR‑14 | Questions – MIC shall expose unresolved questions to Michael and associate answers with the work item/run that needed them. |
| FR‑15 | Evidence – MIC shall capture deterministic and AI‑produced evidence. |
| FR‑16 | Revision Binding – Evidence, approvals and artifacts shall be bound to explicit repository revisions. |
| FR‑17 | Gate Evaluation – MIC shall deterministically determine whether required gate evidence is present and passing. |
| FR‑18 | Safe Integration – MIC shall only integrate implementation output after its required gates and approval policy have been satisfied. |
| FR‑19 | Provenance – Michael shall be able to reconstruct the complete history of a work item. |
| FR‑20 | Model Scheduling – MIC shall know which model each run requires and coordinate model availability. |
| FR‑21 | Queueing – MIC shall provide persistent priority queues, retries, timeouts and dead‑letter handling. |
| FR‑22 | Recovery – MIC shall recover correctly after process or machine restart. |
| FR‑23 | User Interface – The PWA shall display project status, work items, approvals, questions, runs, evidence, model/queue state. |
| FR‑24 | Audit – Every consequential transition and user decision shall generate an append‑only audit event. |

---

## 17. Non‑Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR‑01 | Restart Safety – A reboot must not lose accepted intent, approvals, queued work or completed artifacts. |
| NFR‑02 | Idempotency – Repeating a command or delivery event must not create duplicate logical work. |
| NFR‑03 | Isolation – Worker changes must not modify the production/base branch directly. |
| NFR‑04 | Bounded Context – No design should depend on a continuously growing LLM conversation. |
| NFR‑05 | Replaceable Harnesses – OpenCode, BMAD and bmad‑loop integrations should sit behind adapters rather than leak throughout MIC's domain model. |
| NFR‑06 | Replaceable Models – Domain state must not depend on a particular LLM family. |
| NFR‑07 | Local First – The initial working system should be capable of operating using local inference. |
| NFR‑08 | Secure Model Plane – Raw llama.cpp endpoints remain loopback/private infrastructure rather than the public application boundary. |
| NFR‑09 | Human Legibility – Critical state must be understandable without reconstructing an agent conversation. |
| NFR‑10 | Observability – MIC shall expose enough telemetry to answer:\n  - What is working?\n  - What is waiting?\n  - What is blocked?\n  - Which model is loaded?\n  - What is consuming resources?\n  - What decision does Michael need to make? |

---

## 18. User Stories

*(Only a selection is shown; the full list is in the source document.)*

1. **Create a project** – Register a product once so MIC can manage its work over months or years.
2. **Register project repositories** – MIC understands which repos serve planning, application and infrastructure roles.
3. **Submit product intent** – Describe a desired change conversationally; MIC creates a work item preserving the original intent.
4. **Receive a planning‑grade proposal** – MIC/BMAD turn intent into a coherent product plan.
5. **Approve product direction** – Explicit planning gate before technical work.
6. **Perform technical discovery** – Investigate implementation constraints after planning approval.
7. **Receive implementation‑grade work** – Hardened execution package before autonomous implementation.
8. **Approve implementation** – Separate approval from planning.
9. **Run a story autonomously** – Fresh context, isolated worktree, captured evidence.
10. **Run an approved epic** – Use bmad‑loop for multi‑story execution.
… (remaining stories continue as in the full document).

---

## 19. Phase 0 – BMAD/OpenCode/Local‑Model Pilot

Phase 0 validates the execution stack before any MIC production code is built.

### Pilot questions

- Can OpenCode reliably drive BMAD using the local llama.cpp endpoint?
- Can the selected local model follow BMAD's planning workflow?
- Can it perform **bmad‑build‑auto** reliably?
- Does OpenCode expose the sub‑agent capability Build Auto requires?
- What exact durable artifacts does direct Build Auto write?
- How does **blocked** behave in practice?
- How should a corrected blocked story be safely retried?
- Can **bmad‑loop** execute a small approved epic correctly?
- What are the exact CLI/config contracts?
- What model/context/runtime profile is sustainable on the workstation?

### Pilot procedure (throw‑away repository)

1. BMAD install/configure
2. Small planning task → planning artifact
3. One manually supervised Build Auto story
4. One unattended Build Auto story
5. Blocked/recovery test
6. 2‑3 story bmad‑loop test
7. Independent validation

### Capture

- BMAD version, OpenCode version, bmad‑loop version, llama.cpp revision, model, context configuration, exact commands, artifact paths, status formats, tool failures, token counts, inference timing, peak memory, manual interventions.

### Exit criteria

Phase 0 passes only if:

- OpenCode can invoke required BMAD functionality locally.
- Required sub‑agent behavior works, or an alternate BMAD path is validated.
- At least one supervised and one unattended representative build complete correctly.
- Machine‑readable/durable terminal state is dependable.
- Evidence accurately corresponds to code changes.
- Blocked behavior is understood.
- bmad‑loop behavior is sufficiently understood to decide inclusion in v1.
- Local resource consumption leaves acceptable workstation headroom.

---

## 20. Implementation Ideas After Phase 0

*(Architectural candidates – not implementation instructions.)*

- **MIC service** – TypeScript service containing API, domain commands, state machine, outbox, queue workers, scheduler, execution adapters, artifact indexer, model router client, SSE.
- **Database** – PostgreSQL for domain state, audit, outbox, pg‑boss.
- **Data access** – Drizzle for schema/migration.
- **Queue** – pg‑boss durable queue.
- **Harness** – OpenCode as replaceable execution adapter.
- **BMAD** – Install/configure per project, pin version.
- **bmad‑loop** – Integrate only after Phase 0 demonstrates value.
- **Gates** – Start with deterministic checks; add AI/TEA where beneficial.

---

## 21. Milestone Plan

| Milestone | Goal |
|-----------|------|
| 0 | Validate the execution stack (Phase 0 report). No MIC production before this gate. |
| 1 | Durable MIC kernel – Postgres, project/repository model, work items, lifecycle state machine, audit, transactional outbox, pg‑boss, basic API. Prove restart durability. |
| 2 | Harness + direct BMAD – worktree manager, OpenCode adapter, BMAD direct adapter, run records, artifact indexer, blocked/question handling. Demonstrate one full approved implementation → Build Auto → evidence cycle. |
| 3 | Planning lifecycle – DISCOVERY, PLANNING_GRADE, planning approval, TECHNICAL_DISCOVERY, IMPLEMENTATION_GRADE, implementation approval with BMAD artifact indexing. |
| 4 | Gates and integration – deterministic gates, revision‑bound evidence, controlled integration. |
| 5 | Scheduler and model control – integrate llama.cpp router with resource‑aware queues and model policy. |
| 6 | PWA – chat/intake, projects, work, approvals, questions, runs, models, queue, evidence, timeline. |
| 7 | bmad‑loop – adopt for approved multi‑story epics if Phase 0 supports it. |
| 8 | Edges – incremental n8n, voice, remote access. |

---

## 22. Key Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Local model reliability | High | Hard Phase‑0 gate and comparative model testing. |
| R2 | Sub‑agent compatibility | High | Verify sub‑agent behavior in Phase 0; pin versions. |
| R3 | BMAD contract churn | Medium/High | Version pinning, adapter boundary, captured fixtures, upgrade tests. |
| R4 | bmad‑loop churn | Medium | Keep optional and replaceable. |
| R5 | Database/Git drift | Medium | Clear ownership: Git → artifacts, Postgres → orchestration; re‑index when needed. |
| R6 | Multi‑repo integration complexity | Medium | Explicit repository identity from first migration. |
| R7 | Evidence staleness | High | Bind evidence and approvals to exact revisions. |
| R8 | Queue/state split‑brain | High | Transactional outbox + idempotent workers. |
| R9 | Agent‑context explosion | High | Fresh sessions, typed hand‑offs, artifact references. |
| R10 | Excessive human gating | Medium | Planning and implementation approvals are core; post‑implementation acceptance is policy‑driven. |

---

## 23. Planning Decisions Requested From Michael

- MIC remains the organizational/control plane.
- BMAD becomes the default software‑development protocol.
- LangGraph is removed from MIC's foundational path.
- Projects support multiple repositories from day one.
- Planning approval and implementation approval remain separate gates.
- Agent sessions are disposable; Postgres/Git are durable.
- Direct BMAD and bmad‑loop use separate execution adapters.
- Evidence and approvals are revision‑bound.
- Queue dispatch uses a transactional outbox.
- Phase 0 must pass before the architecture is promoted to implementation‑grade.

---

## 24. Definition of Implementation‑Grade

The epic becomes implementation‑grade only after Phase 0 replaces assumptions with observed contracts. The next revision must contain:

- exact BMAD version
- exact OpenCode version
- exact bmad‑loop decision/version
- exact BMAD installation/configuration approach
- verified sub‑agent behavior
- verified direct Build Auto artifact contract
- verified blocked/recovery behavior
- verified OpenCode invocation
- verified llama.cpp configuration
- measured model/context profile
- final database schema
- final state‑transition table
- final adapter interfaces
- final worktree strategy
- final gate definitions
- final implementation sequence

At that point Michael receives a second document for implementation approval.

**Current status:** PLANNING‑GRADE — ready for planning review, not ready to authorize implementation.

---

*Document generated automatically on 2026‑09‑03.*
