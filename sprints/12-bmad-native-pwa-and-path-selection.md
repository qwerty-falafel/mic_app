# Sprint 12 – BMAD-native PWA and Path Selection

**Epic:** [BMAD-native MIC PWA](./epic-bmad-native-mic.md)
**Depends on:** Sprint 11 artifact intelligence

## Goal

Replace the checkpoint UI with the BMAD-native control surface described in the product plan and make path selection understandable without requiring prior BMAD expertise.

## Product increment

From the browser, a user can enter a project, describe new work, ask BMAD what to do next, choose a supported path and follow the resulting workflow sessions and artifacts.

## Work

1. Build a Home view focused on active work, attention, queues, recent outcomes and resource status.
2. Move project/repository creation into dedicated setup flows with Git and BMAD health checks.
3. Build a Project view showing repository state, installed BMAD version/modules, project context health, workstreams and artifact freshness.
4. Integrate `bmad-help` as **Ask BMAD what next**, retaining the recommendation, reasoning and evidence.
5. Build Start Work around plain-language intent and supported choices:
   - direct attended Build;
   - spec-backed epic;
   - project-sized planning;
   - research, review or Correct Course;
   - explicit skill selection.
6. Explain expected workflows, interaction level and artifacts before the user chooses a path.
7. Build the Workstream activity/artifact view instead of a universal fixed timeline.
8. Build the Workflow Session interface from Sprint 10 and the Artifact/Review interface from Sprint 11 into the main navigation.
9. Add clear empty, loading, waiting, blocked, interrupted and invalid-artifact states.
10. Make primary tasks usable on desktop and a narrow browser without pursuing offline support or decorative polish.

## Acceptance criteria

- Project and repository setup no longer dominate the Home view.
- `bmad-help` can recommend a path and the PWA shows why it was recommended.
- The user explicitly chooses the path before a workflow begins.
- Direct, spec-backed and project paths produce distinct workstream structures without code changes.
- Every action names the BMAD skill and concrete operation it will invoke.
- Waiting-for-input and needs-attention states are more prominent than raw logs.
- A user can navigate from an intent to its sessions, artifacts, reviews and Git workspace.
- Browser acceptance tests cover the principal happy path and a blocked interaction.

## Exit and review

Michael starts representative direct, epic and project workstreams in scratch repositories and confirms that the interface explains the differences and never implies that an unperformed workflow is complete.
