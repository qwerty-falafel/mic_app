# BMAD-native MIC implementation report

## Sprint 08 — truthful baseline

The legacy TTS work item is paused with an audited reason. Empty technical discovery and unconstrained Build Auto controls are removed. Legacy implementation dispatch requires a direct intent, spec path or exact story. The contract observatory and Phase-0 fixtures retain commands, OpenCode JSONL, changed files, Git state and resources. Named command dispatch and required BMAD configuration values replace the assumptions disproved by live GPT-OSS 120B runs.

## Sprint 09 — catalog and workstreams

Migration 0003 adds native workstreams, workflow definitions, sessions, turns, artifact revisions and review decisions without deleting legacy tables. Repository catalog refresh reads `bmad-help.csv` and the installed manifest, fingerprints them, resolves layered configuration against the attached repository and exposes valid operations by selected path. `BmadRunnerAdapter` accepts `{skill, action, args, prompt, repository, workspace}` and rejects malformed or undiscovered operations before execution.

## Sprint 10 — durable sessions

Migrations 0004 and 0005 add worktree provenance, provider sessions, terminal timestamps and idempotent conversation commands. Sessions use `--command` once and `--session` for later turns. MIC persists ordered user/assistant turns, serializes model work, exposes pause/resume/cancel/classification actions, marks in-flight sessions interrupted on restart and emits SSE events. An exit without a terminal artifact or clear prompt becomes `NEEDS_CLASSIFICATION`.

## Sprint 11 — artifacts and review

Migration 0006 stores artifact content as an immutable revision. The index recognizes specs, memlogs, story inventories, sprint status, architecture, PRDs and story records; parses frontmatter and review cues; links cited artifacts; and marks stale consumers. Invalid statuses, missing spec companions, rewritten memlog history and malformed story IDs are quarantined. Review decisions bind to exact revisions. Feedback creates a new owning-workflow session.

## Sprint 12 — PWA

The browser now has separate Home, Projects, Project and Workstream surfaces. Home prioritizes attention and resource/queue state. Project setup shows Git/BMAD health and explains direct, spec-backed, project-sized and specialist paths before selection. Workstreams show the real Git workspace, installed operations, live transcripts, artifacts, review cues and explicit empty/waiting/blocked/interrupted states. Active sessions update over SSE.

## Sprint 13 — story delivery

Migration 0007 adds ordered story units and integration decisions. MIC reads the latest valid `stories.yaml`, preserves exact identifiers, and constructs a one-story prompt with its parent inventory. Build Auto rejects missing or unbounded context. Story evidence and status are durable; retrospective readiness rejects unfinished inventories; integration requires a clean base repository and a fast-forward result. bmad-loop stays unavailable because its captured pilot did not complete a story.

## Verification

- TypeScript backend build: pass.
- React TypeScript check and production Vite build: pass.
- Automated suite: 34 tests pass, including restart persistence, idempotent kernel commands, revision-bound legacy approvals, blocked-question persistence, generic named-skill dispatch, OpenCode session continuation, artifact parsing, immutable revision review and memlog quarantine.
- Live HTTP smoke: health, PWA asset, catalog health, effective attached-project paths, attention and queue/resource status respond at `127.0.0.1:3100`.
- TTS base repository: clean at `68424548a10d86c1bdbd330e0222def1e2c9aa3e`.

The remaining validation is intentionally product-facing: complete a real interactive BMAD session through the PWA, rehearse story delivery, then run the fresh TTS workstream through planning and stop for Michael's artifact review. These are acceptance runs of implemented capabilities rather than hidden infrastructure tasks.
