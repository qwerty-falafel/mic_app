# Sprint 06 – MIC Control Surface (PWA)

**Goal**: Deliver a minimal Progressive Web App that exposes the MIC state machine, projects, work items, approvals, questions, runs, evidence, and queue status. The UI consumes the API built in earlier sprints and receives live updates via Server‑Sent Events.

### Exit Criteria
The sprint ends when the **PWA Acceptance Test Suite** verifies that a user (Michael) can perform the full workflow—from creating a work item to approving implementation—entirely through the UI, and the underlying state persists across a service restart.

---

### Discovery Tasks
1. **Core UI wireframes** – sketch the main screens (Dashboard, Project list, Work‑item detail, Approvals, Questions, Run monitor). Identify which data each view requires.
2. **Component library decision** – choose a lightweight React framework (e.g., Vite + React) or SvelteKit; ensure offline‑first capability for a PWA.
3. **SSE integration** – define the event payload format (`event: lifecycle`, `data: {runId, newState}`) and how the frontend will subscribe.
4. **Authentication model** – decide on a simple JWT flow (login endpoint already exists in the Fastify API) and how the token is stored securely in the browser.
5. **Accessibility & Responsiveness** – outline requirements for keyboard navigation and mobile view.

---

### Implementation Tasks
| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 1 | Scaffold **frontend** project under `frontend/` using Vite + React (or SvelteKit). | Cline | `npm run dev` launches the app on `localhost:3000`.
| 2 | Implement **Dashboard** component showing:
   - System health (resource monitor summary).
   - Queue length and next scheduled run.
   - Quick links to Projects and Approvals.
   | Cline | Dashboard renders data from `/metrics`, `/scheduler`, `/projects`.
| 3 | Build **Project List** and **Project Detail** pages that display repositories and associated work items. | Cline | Navigation works; data matches API responses.
| 4 | Create **Work‑Item Detail** view with tabs for:
   - Lifecycle state timeline.
   - Evidence files (download links).
   - Approvals (show pending approvals, allow approve/reject actions).
   - Questions (list, answer inline).
   | Cline | All tabs load data; approve/reject updates state via API and reflects instantly via SSE.
| 5 | Implement **Run Monitor** page showing live run status, logs, and a cancel button (calls `POST /runs/:id/cancel`). | Cline | Run status updates in real time; cancel works.
| 6 | Add **SSE client** (`src/sse.ts`) that subscribes to `/events` and updates a global store (e.g., Zustand or Redux). | Cline | UI reacts to lifecycle events without manual refresh.
| 7 | Wire **authentication** – login form, token storage in `httpOnly` cookie, automatic token refresh. | Cline | Protected endpoints return 401 without token; UI handles login flow.
| 8 | Write **Playwright end‑to‑end tests** that cover:
   - Login.
   - Creating a project and repository.
   - Submitting a work item intent.
   - Approving planning and implementation via UI.
   - Observing run progress and completing a Build Auto execution.
   | Cline | All tests pass on CI; coverage ≥ 80 % of UI components.
| 9 | Generate **PWA manifest** and service worker for offline caching of static assets. | Cline | App can be installed in Chrome; loads offline shell.
| 10 | Update **OpenAPI** with any new UI‑specific endpoints (e.g., `/auth/login`). | Cline | Spec validates.

---

### Acceptance Criteria (overall)
* Michael can perform the entire end‑to‑end workflow through the UI without using curl or Postman.
* All state changes are persisted; restarting the backend does not lose projects, work items, approvals, or evidence.
* Live updates arrive via SSE; no manual page reload required.
* UI meets basic accessibility standards (ARIA labels, keyboard navigation).
* The PWA can be installed and works offline for static assets.
* Automated Playwright tests pass on every CI run.

### Dependencies
* **Sprint 02** – core API and authentication.
* **Sprint 04** – full lifecycle endpoints.
* **Sprint 05** – scheduler status and gate evaluation endpoints.

### Review & Approval
* **Deliverable** – `frontend/` source tree, Playwright test suite, PWA manifest, and updated OpenAPI spec.
* **Approval** – Michael reviews the UI, runs through the workflow, and signs off before Sprint 07.
