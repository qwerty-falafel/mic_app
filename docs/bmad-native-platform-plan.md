# BMAD-native MIC product direction

Status: accepted direction; decomposed into [the BMAD-native MIC epic](../sprints/epic-bmad-native-mic.md)
Date: 2026-09-06

## Decision

MIC should be a local control plane for BMAD, not a second development method layered over it. BMAD owns development paths, workflow steps, artifact meanings, and workflow-level interaction. MIC owns projects, repositories, isolated Git workspaces, durable sessions, queues, resource policy, provenance, notifications, and human attention.

The installed skill catalog and artifacts are the source of truth. MIC should discover them rather than hard-code a universal lifecycle.

## Research basis

The official BMAD workflow map organizes work into Analysis, Planning, Solutioning, and Implementation, while also providing a parallel Quick Flow. It emphasizes progressive context rather than one mandatory pipeline:

- [Workflow Map](https://docs.bmad-method.org/reference/workflow-map/)
- [Choose a Planning Path](https://docs.bmad-method.org/plan/choose-a-planning-path/)
- [Break Work into Stories and Track It](https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/)
- [Build a Change](https://docs.bmad-method.org/build/build-a-change/)
- [Autonomous Development Loops](https://docs.bmad-method.org/reference/build-auto/)
- [Start in an Existing Codebase](https://docs.bmad-method.org/existing-codebases/start-in-an-existing-codebase/)
- [Plan Inside an Organization](https://docs.bmad-method.org/plan/plan-inside-an-organization/)
- [Walk Through a Change](https://docs.bmad-method.org/build/walk-through-a-change/)

The installed BMAD 6.12 catalog at `_bmad/_config/bmad-help.csv` agrees with this model and is more useful to MIC than a copied phase list because it records installed modules, skills, actions, sequencing hints, required flags, output locations, and output types.

## The native BMAD paths

### Direct change

For a small, clear change, run one attended `bmad-build`. It investigates, plans at the necessary depth, asks for decisions when warranted, implements, reviews, fixes, and presents the result.

### Spec-backed epic

For one coherent outcome needing several Build sessions:

1. Run `bmad-spec` to create the shared contract.
2. Run Story Breakdown to create ordered `stories.yaml` beside the spec.
3. Review story order and choose checkpoints.
4. Run one `bmad-build` per important or pattern-setting story.
5. Use `bmad-build-auto` only for a single stable story at a time.
6. Let MIC or `bmad-loop` dispatch the ordered inventory.
7. Run `bmad-retrospective` against the complete epic and its evidence.

### Project-sized work

For a product, a multi-epic initiative, or work with significant coordination risk:

1. Use the Analysis workflows that earn their cost: research, brief, PRFAQ, or brainstorming.
2. Create requirements with `bmad-prd`; add `bmad-ux` when UX decisions matter.
3. Run `bmad-architecture` for shared technical decisions.
4. Run `bmad-create-epics-and-stories` collaboratively.
5. Run `bmad-sprint-planning`; its readiness gate must pass before it creates `sprint-status.yaml`.
6. Create a spec per epic where useful and build one story per session.
7. Review and close each epic with evidence and a retrospective verdict.

The amount of process follows scope, uncertainty, risk, and coordination. Story counts are guidance rather than a routing rule.

## What went wrong in the current MIC

The current PWA presents one fixed sequence and labels state transitions as completed work. In reality:

- Planning always invokes `bmad-spec`.
- Technical discovery accepts an empty object and invokes no BMAD workflow.
- Implementation immediately invokes one `bmad-build-auto` against the whole intent.
- The PWA cannot carry a multi-turn BMAD conversation, display a workflow menu, or resume a workflow session.
- Artifacts appear as an undifferentiated file list rather than an evolving context graph.
- A successful process exit plus a changed `SPEC.md` is accepted without enforcing BMAD's artifact contract.
- Project creation and repository attachment forms dominate the home screen, while guidance and active work are absent.
- The fixed timeline cannot represent direct, spec-backed epic, project, review-only, research, correction, or retrospective paths.

The planning revision exposed the contract problem: it changed the spec but rewrote the append-only memlog and failed to preserve explicit review details. MIC recorded a new hash but did not determine whether BMAD had produced a valid revision.

## Product model

MIC should separate four kinds of state.

### BMAD workflow state

Owned by the active skill and its session: the current step, menu, questions, draft status, terminal status, and resume contract.

### BMAD artifact state

Owned by files: frontmatter, memlogs, companions, source relationships, readiness results, `stories.yaml`, story records, sprint status, findings, and retrospectives.

### MIC execution state

Owned by the control plane: queued, waiting for resources, running, awaiting user input, cancelled, failed, blocked, and finished. This is independent of the BMAD phase.

### Git delivery state

Owned by repository provenance: baseline, isolated branch/worktree, commits, diff, review target, mergeability, and final integration.

A workstream can therefore have several fresh workflow sessions and many artifacts without being forced into one enum.

## Proposed PWA information architecture

### Home

Show active work, items needing attention, queued/running sessions, recent outcomes, model/resource status, and a clear project switcher. Move project and repository creation into dedicated setup screens.

### Project overview

Show repository cleanliness, base branch, BMAD version and installed modules, project context health, active workstreams, artifact freshness, and a prominent **Ask BMAD what next** action backed by `bmad-help`.

### Start work

Accept a plain-language intent and ask BMAD to recommend a path. Present the recommendation with its reason and expected artifacts:

- direct Build;
- spec-backed epic;
- project planning;
- research/review/correct-course workflow;
- manual skill selection for experienced users.

The user chooses the path. MIC does not silently turn a feature into a project or collapse a project into one Build Auto run.

### Workstream

Replace the fixed lifecycle timeline with a graph or ordered activity stream of workflow sessions and artifacts. Show the selected path, current BMAD recommendation, upstream context, story progress, decisions, blocked conditions, and next valid actions.

### Workflow session

Make BMAD's conversation the primary interface:

- transcript and current workflow step;
- response composer and explicit menu choices;
- pause, resume, cancel, and start-fresh-session controls;
- files created or changed during the session;
- assumptions, open questions, conflicts, and terminal status;
- live logs in a secondary diagnostics panel.

BMAD recommends a fresh chat for each workflow. MIC should preserve each session separately and pass context through artifacts, not an ever-growing hidden chat transcript.

### Artifacts

Render Markdown and structured YAML inside MIC. Show artifact type, status, owning skill, version history, sources, consumers, validation results, branch/commit, and review decisions. Feedback returns to the owning workflow as an update or validation input. Raw files and diffs remain available.

### Stories and delivery

Render `stories.yaml` or `sprint-status.yaml` as the native backlog. Show each story's BMAD status and implementation record. Dispatch exactly one story to Build or Build Auto. Expose ordered `bmad-loop` execution only after the manifest and decisions are stable.

### Review and human attention

Use BMAD's natural decision points rather than adding approval gates after every file. The official organization guidance identifies useful sign-off moments: PRFAQ verdict, PRD validation, architecture spine review, readiness gate, and retrospective verdict. Add attended Build plan decisions and final walkthrough approval where personal control is valuable.

The attention inbox should combine workflow questions, menu choices, plan decisions, blocked runs, architecture reviews, readiness concerns, walkthrough decisions, and retrospective verdicts.

## Backend architecture

1. **Catalog discovery** — parse the installed BMAD help catalog and skill manifests per repository. Store a cache with installation fingerprint; do not copy the workflow definitions into MIC code.
2. **Generic skill runner** — invoke any installed skill with a named action and arguments. Planning and implementation are no longer two hard-coded adapter modes.
3. **Durable sessions** — persist conversation turns, BMAD step/menu state, process identity, and resume information. Interactive workflows must be able to wait for user input without being declared complete.
4. **Artifact indexer** — snapshot configured output locations, parse Markdown frontmatter and YAML, link revisions to runs and Git commits, and validate type-specific invariants such as append-only memlogs.
5. **Guidance service** — run `bmad-help` against project artifacts to recommend next actions. Cache the recommendation but retain its evidence and source session.
6. **Path/workstream model** — record the chosen planning path and its artifact graph. Do not encode BMAD phases as one irreversible state enum.
7. **Story dispatcher** — select one unit from `stories.yaml` or sprint status, then invoke attended Build or one Build Auto worker. Backlog policy remains in MIC or `bmad-loop`, never inside Build Auto.
8. **Review service** — bind decisions and feedback to artifact revisions or implementation commits. A revision supersedes an older decision without deleting audit history.
9. **Resource scheduler** — keep MIC's useful local responsibilities: one loaded GPT-OSS 120B model, memory gates, cancellation, queue visibility, and recovery.
10. **Git workspace service** — keep isolated worktrees, clean-base checks, provenance, diff presentation, fast-forward safety, and explicit integration.

## Delivery plan

The executable breakdown is indexed in the [active sprint roadmap](../sprints/README.md). Milestones 0–6 below correspond to Sprints 08–14.

### Milestone 0 — stop the misleading path

- Disable whole-intent Build Auto when no valid story/spec dispatch target exists.
- Mark the TTS experiment paused and its current planning revision superseded without deleting its audit history.
- Replace misleading completion labels with the real operation or an explicit unavailable state.

### Milestone 1 — capture real contracts

In isolated scratch repositories, run representative installed workflows through GPT-OSS 120B and capture:

- `bmad-help` recommendation output;
- attended Build plan questions and resume behavior;
- `bmad-spec` create, update, validate, and Story Breakdown;
- architecture create/review;
- epics-and-stories menus and checkpoints;
- sprint readiness PASS/CONCERNS/FAIL and tracking output;
- one Build and one folder-plus-story Build Auto dispatch;
- blocked, cancelled, interrupted, and resumed outcomes;
- walkthrough and retrospective outputs.

The contract report must identify which state is available in files, structured output, stdout, and conversation only.

### Milestone 2 — generic workflow engine

- Add catalog, workflow-session, conversation-turn, artifact-revision, artifact-link, and review-decision persistence.
- Replace mode-based adapter dispatch with skill/action/argument dispatch.
- Add waiting-for-input and resumable-session behavior.
- Add artifact validation and event streaming.

### Milestone 3 — BMAD-native PWA shell

- Build Home, Project, Start Work, Workstream, Workflow Session, Artifact, Attention Inbox, and Settings views.
- Integrate `bmad-help` as guidance.
- Render artifacts and version comparisons in-app.
- Preserve diagnostics without making raw JSON the main experience.

### Milestone 4 — planning paths

- Support direct Build.
- Support spec-backed epics and Story Breakdown.
- Support project planning through PRD/UX/Architecture/Epics/Sprint Planning.
- Surface every workflow interaction and native review point.

### Milestone 5 — delivery and review

- Add stories/sprint tracking views.
- Dispatch one Build or Build Auto unit at a time.
- Add code review, walkthrough, evidence, retrospective, and correct-course flows.
- Integrate bmad-loop only as an optional ordered dispatcher.

### Milestone 6 — recover the TTS pilot

Use the TTS feature as the acceptance test for the spec-backed epic path:

1. Establish or audit project context for the existing repository.
2. Re-run `bmad-spec` update/validation using the original intent and review feedback.
3. Verify preservation and append-only memlog behavior.
4. Run Story Breakdown and review `stories.yaml`.
5. Use attended Build for the first risky or pattern-setting story.
6. Dispatch later stable stories individually, using Build Auto only when appropriate.
7. Run integration checks, walkthrough, and the spec-backed retrospective.
8. Present the complete branch and evidence for final human acceptance.

## Acceptance criteria for the redesign

- The same MIC installation can represent direct, spec-backed epic, and project-sized BMAD paths without code changes.
- Every UI action names the BMAD skill and operation it actually invokes.
- An interactive workflow can wait for a user response and resume without losing its artifact or conversation state.
- `bmad-help` can inspect a project and its recommendation is visible with the evidence it used.
- BMAD artifacts remain authoritative; MIC detects invalid mutations and stale downstream artifacts.
- Build Auto receives exactly one session-sized intent or story.
- The PWA provides a readable review experience for documents and code, including feedback tied to a revision.
- No code reaches the base branch without a comprehensible walkthrough, evidence, and explicit integration decision.
