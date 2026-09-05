# Sprint 07 – Optional Autonomy & Hardening

**Goal**: Integrate `bmad-loop` for multi‑story epic execution, add optional automation hooks (n8n, voice), and harden the deployment (systemd service, security hardening, end‑to‑end acceptance testing).

### Exit Criteria
Sprint ends when the **Autonomy Acceptance Suite** demonstrates that a multi‑story epic can be executed via `bmad-loop` with proper revision‑bound artifacts, and the MIC service can be started/stopped as a systemd unit without loss of state.

---

### Discovery Tasks
1. **bmad‑loop contract finalisation** – using the fixtures from Sprint 01, confirm the exact shape of `result.json` and the required CLI flags.
2. **Multi‑story epic design** – define a small example epic (3 stories) that exercises ordering, dependencies, and shared resources.
3. **Automation hook evaluation** – assess feasibility of triggering MIC actions from n8n or a voice command (e.g., “run approved epic”).
4. **Security hardening checklist** – list required measures (least‑privilege system user, file permissions, SELinux/AppArmor profile, TLS for API).
5. **Systemd service design** – decide on ExecStart, Restart=on‑failure, and environment variable handling for model ports.

---

### Implementation Tasks
| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 1 | Add **bmad‑loop adapter** (`src/adapters/bmadLoop.ts`) that re‑uses the worktree manager, invokes `bmad-loop run <epic‑manifest>`, and translates `result.json` into a `RunResult`. | Cline | Successful run yields `status: "done"` and populated `artifactRefs`.
| 2 | Extend the **Lifecycle Service** to handle an `EXECUTE_EPIC` transition that dispatches the `bmad-loop` adapter. | Cline | Epic execution creates a series of run records linked to the epic.
| 3 | Implement **automation hooks**:
   - Simple n8n webhook endpoint (`POST /hooks/n8n`) that can trigger `EXECUTE_EPIC` for an approved epic.
   - Optional voice‑command stub (exposes `POST /hooks/voice`). | Cline | Hook endpoints accept a JSON payload and return a job ID; jobs appear in the queue.
| 4 | **Security hardening** – add a **system user** `micsvc`, set file permissions on the data directory, configure **SELinux** policy (or AppArmor), enforce HTTPS on the API (self‑signed cert for local dev). | Cline | Security audit script reports no critical findings.
| 5 | Create **systemd unit file** (`mic.service`) that starts the Fastify server, sets `Restart=on-failure`, and loads environment variables from `/etc/mic/env`. | Cline | `systemctl start mic` runs the service; `systemctl status mic` shows healthy.
| 6 | Write **end‑to‑end acceptance tests** that:
   - Approve an epic via API.
   - Trigger execution through the n8n webhook.
   - Verify each story runs, evidence is recorded, and the epic reaches `DONE`.
   - Restart the systemd service mid‑execution and ensure state is recovered.
   | Cline | All scenarios pass; logs show proper recovery.
| 7 | Update **OpenAPI** with webhook endpoints and any new status fields. | Cline | Spec validates.

---

### Acceptance Criteria (overall)
* `bmad-loop` adapter correctly processes multi‑story epics and produces revision‑bound artifacts.
* Automation hooks can trigger epic execution and respect MIC’s approval gates.
* The MIC service runs as a systemd unit, recovers from crashes without losing queued jobs or state.
* Security hardening checklist is satisfied.
* End‑to‑end acceptance suite passes.

### Dependencies
* **Sprint 01** – artifact fixtures.
* **Sprint 04** – lifecycle infrastructure.
* **Sprint 05** – scheduler and resource controls.
* **Sprint 06** – UI (optional for manual trigger verification).

### Review & Approval
* **Deliverable** – `src/adapters/bmadLoop.ts`, webhook handlers, systemd unit, security config, and acceptance test suite.
* **Approval** – Michael reviews the design, runs the acceptance tests, and signs off.
