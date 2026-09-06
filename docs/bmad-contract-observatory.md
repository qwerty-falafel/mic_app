# BMAD 6.12 observable contracts

This report records what MIC can prove about the installed BMAD system. It separates observed transport and file contracts from workflow outcomes. The reproducible runner is `scripts/phase0-validate.ts`; raw commands, JSONL, files, Git revisions and resource samples are stored under `test/fixtures/phase0/`.

## Installed system

- BMAD installation: 6.12.0.
- Installed modules: core 6.12.0, BMM 6.12.0, CIS 0.3.2, bmad-loop 0.11.1, TEA 1.24.0, GDS 0.7.2 and BMad Builder 2.2.2.
- OpenCode: 1.18.27.
- Default model: `llama.cpp/gpt-oss-120b-F16` through the local router at `127.0.0.1:10000`.
- The authoritative capability catalog is `_bmad/_config/bmad-help.csv`. It can contain several actions for one skill, so `(skill, action)` is the operation identity.
- Configuration merges installer defaults, team overrides, personal overrides and user answers. `{project-root}` must expand to the attached repository or its worktree, even when MIC supplies the shared BMAD installation.

## Transport contract

MIC must invoke generated OpenCode commands with `opencode run --command <skill>`. A prose request such as “use bmad-spec” is not a dispatch contract: GPT-OSS 120B may accurately answer with a suggested command while creating no files. OpenCode JSONL carries a stable `sessionID`, ordered text/tool events, token data and a terminal step. A later turn resumes with `opencode run --session <sessionID>` and must not repeat the named command.

Exit code zero only proves that OpenCode exited normally. It does not prove that BMAD completed. MIC therefore records the raw conversation and changed files, then derives a workflow result from recognized artifacts. A response that has neither a durable terminal artifact nor a clear interaction checkpoint is `NEEDS_CLASSIFICATION`.

## Artifact contract

The observed `bmad-spec` create operation wrote:

- `_bmad-output/specs/spec-arithmetic-pilot/SPEC.md`;
- `_bmad-output/specs/spec-arithmetic-pilot/.memlog.md`.

The memlog is hidden and append-only. MIC indexes it as a companion rather than omitting it from the review record. Specs may later add `stories.yaml`; story identifiers are opaque strings and must pass unchanged into one-story Build dispatches.

Build Auto renders its workflow before doing work. Rendering requires `core.user_name`, `core.communication_language` and `core.document_output_language`. The 2026-09-06 live capture proved that MIC's former minimal injected configuration omitted `communication_language`; the renderer halted before planning. MIC now supplies those required values in scratch and production worktrees. This is a configuration defect, not evidence that implementation completed or that GPT-OSS 120B failed.

Build Auto's terminal contract is Markdown/YAML frontmatter plus its result section. It does not reliably produce a generic `result.json`. `blocked` must be persisted with its reason and partial files. A whole epic or unconstrained work-item intent is not a valid Build Auto unit.

## Workflow and UI consequences

1. Discover skills and actions from the attached repository's catalog; reject unavailable operations before a model starts.
2. Store workstream, workflow session and artifact state separately. A lifecycle label cannot stand in for a BMAD operation.
3. Persist every user and assistant turn, provider session ID, raw output and exact artifact revision.
4. Present interactive questions, ambiguous exits, invalid artifacts and blocked results in one attention inbox.
5. Bind feedback and acceptance to a content hash. Feedback starts the owning workflow again with the reviewed path and revision.
6. Quarantine a changed historical memlog, missing required companion, malformed story inventory or unknown terminal status.
7. Dispatch exactly one story to Build or Build Auto, retain its parent inventory, and require an explicit fast-forward integration decision.
8. Treat bmad-loop as optional. The observed 0.11.1 run paused with manual rollback required and zero completed stories, so MIC does not expose it as an accepted scheduler.

## Captured mismatches

| Prior MIC assumption | Observed behavior | Platform response |
|---|---|---|
| Planning is any prompt mentioning `bmad-spec` | The model may describe work without invoking the skill | Named command dispatch |
| Technical discovery is an empty state transition | BMAD architecture and discovery are real workflows with artifacts and interaction | Removed false completion action |
| Build Auto accepts the whole work item | Build Auto is one bounded session-sized unit | Explicit direct/spec/story target, then one-story delivery |
| Exit zero means success | Normal exits include questions, render halts and incomplete runs | Artifact-backed terminal state or explicit classification |
| A single approval covers “planning” | BMAD produces independently revised specs, architecture, epics and story inventories | Revision-specific reviews and feedback |
| Five-second polling is adequate | Active workflows have discrete provider events and human waits | SSE session channel |
| BMAD installation paths are the application paths | Shared skills still resolve outputs relative to the attached project | Effective configuration rebased to repository/worktree |
| bmad-loop can schedule the first product version | The observed pilot returned exit zero but paused with no completed stories | Hidden until its real contract passes |

## Evidence status

The named-command spec capture passes with GPT-OSS 120B. The next capture after the configuration correction is the authority for Build/Build Auto behavior. Earlier failed captures remain useful regression fixtures because they prove MIC must surface render failures instead of advancing state. Resource measurements stayed below the conservative 75% combined-memory ceiling with no OOM kill; swap activity makes the old “zero swap pages” criterion too brittle for a long local-model run and is reported as telemetry rather than converted into workflow success.
