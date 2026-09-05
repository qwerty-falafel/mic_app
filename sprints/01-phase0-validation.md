# Sprint 01 – Phase‑0 Execution Validation

> **Fast-track decision (2026-09-05): accepted as sufficient to proceed with deferred validation.** Router connectivity, OpenCode transport, BMAD project discovery and required project skills are established. Successful planning/Build Auto artifacts, a genuine blocked payload and the bmad-loop result contract remain open and will be captured when the execution adapter uses those paths. The original criteria below remain as the record of the intended experiment; they no longer block Sprint 02.

**Goal**: Verify that the existing local inference stack (llama.cpp router, OpenCode harness, BMAD tooling and optional `bmad-loop`) works on a throw‑away repository and capture the *real* durable artifact contracts. No installation of the router is performed – it is assumed to be already running and reachable at `127.0.0.1:10000`.

### Exit Criteria (instead of calendar weeks)
The sprint ends **only when** the *Phase‑0 Validation Report* is produced and signed off by Michael. The report must contain concrete evidence that the assumptions about the execution stack have been either validated or disproved.

---

### Discovery Tasks
1. **Validate existing router** – query the llama.cpp router health endpoint, record latency, memory usage (unified memory on AMD, `MemAvailable` from `/proc/meminfo`), and confirm the model ID(s) advertised.
2. **OpenCode harness inspection** – list available sub‑agent hooks, confirm the `build‑auto` sub‑agent can be invoked, and capture its telemetry output format.
3. **BMAD planning & Build Auto contract capture** – run a minimal planning request through BMAD, then execute a single *Build Auto* story. Capture *all* files written to disk (e.g., spec files, generated code, any JSON/YAML manifest). Do **not** assume a particular filename; record the exact paths.
4. **Blocked‑state exploration** – deliberately trigger a failure in Build Auto (e.g., missing sub‑agent) and record the exact *blocked* payload returned by BMAD. Identify the fields needed to surface a question or remediation step.
5. **bmad‑loop feasibility** – run a tiny 2‑story epic through `bmad-loop`. Capture the CLI arguments, exit status, and the `result.json` (or equivalent) produced.
6. **Resource profiling** – for each successful run, log:
   - Peak unified‑memory usage of the model process.
   - CPU utilisation spikes.
   - Inference latency per token batch.
   - Any OOM or swap events (should be none).

---

### Implementation Tasks (produce the report)
| # | Task | Owner | Acceptance Criteria |
|---|------|-------|----------------------|
| 1 | Write a **validation script** (`scripts/phase0-validate.ts`) that performs tasks 1‑6 automatically and outputs a markdown report. | Michael / Cline | Script runs end‑to‑end on a fresh clone; exits 0 only if all checks pass.
| 2 | Capture **fixtures**: the exact artifact directory tree from the Build Auto run and the `result.json` from the bmad‑loop run. Store them under `test/fixtures/phase0/`. | Cline | Fixtures are version‑controlled and referenced in the report.
| 3 | Draft **Phase‑0 Validation Report** (`docs/phase0-validation.md`) containing:
   - Router health summary.
   - OpenCode sub‑agent capabilities.
   - Full list of durable artifacts produced by Build Auto (paths, formats).
   - Blocked payload schema.
   - bmad‑loop contract details.
   - Resource profile tables.
   - Decision matrix: *validated* vs *needs redesign*.
|   | Cline | Report is clear, reproducible, and signed off.
| 4 | Review meeting with Michael – walk through the report, answer questions, and obtain explicit **Phase‑0 sign‑off**. | Michael | Michael records approval in the sprint tracker.

---

### Acceptance Criteria (overall)
* The existing llama.cpp router is reachable and meets the memory/latency thresholds (no OOM, `MemAvailable` stays > 200 MiB, latency < 200 ms per request).
* OpenCode exposes the required sub‑agent hook for Build Auto.
* The actual durable artifact contract(s) from Build Auto are identified and stored as fixtures.
* Blocked state payload is fully understood and can be mapped to a *question* record.
* bmad‑loop produces a deterministic `result.json` contract.
* All findings are documented; any assumption that proved false is noted for redesign in later sprints.

### Dependencies
* None – this sprint runs before any MIC code is written.

### Review & Approval
* **Deliverable** – `docs/phase0-validation.md` and the accompanying fixture directory.
* **Approval** – Michael signs off; the sprint is considered complete and the next sprint may begin.
