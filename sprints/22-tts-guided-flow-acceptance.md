# Sprint 22 – TTS Guided-flow Acceptance

**Epic:** [Guided Product Delivery UX](./epic-guided-product-delivery-ux.md)
**Depends on:** Sprint 21 journey validation

## Goal

Validate the redesigned MIC experience by resuming the preserved TTS delivery case from its real planning checkpoint and advancing it through the native BMAD path.

## Starting conditions

- The TTS base repository remains clean at its preserved baseline.
- Its MIC worktree, branch, sessions, artifact revisions, review history, and quarantined history remain intact.
- The latest `SPEC.md` and `.memlog.md` remain valid and unapproved unless Michael has explicitly decided otherwise.
- GPT-OSS 120B remains MIC's default model.

## Product increment

Michael can open Home, understand the TTS epic's current state, review or revise its spec, accept the exact revision, start Story Breakdown from the guided next action, review the resulting stories, and dispatch the first eligible story without using raw BMAD commands or losing access to their provenance.

## Work

1. Migrate the existing TTS workstream presentation into the new Product, Brief, classified Epic, and stage projection without rewriting its evidence.
2. Verify Home and the TTS Product show `Specification review`, the pending artifact, and the expected next result.
3. Review the valid spec in the new document workspace and explicitly address the earlier context-session changes already present in the worktree.
4. Exercise another feedback revision only if Michael requests it; otherwise record exact-revision acceptance.
5. Use the guided **Create story plan** action to invoke BMAD Story Breakdown.
6. Review story order, acceptance criteria, dependencies, and attended/automatic checkpoints.
7. Dispatch the first foundational story through attended Build and preserve any question flow.
8. Verify conversation, output, log, evidence, pause/recovery, and Git provenance views during real execution.
9. Continue the TTS feature only as far as Michael authorizes after the UX acceptance checkpoint.
10. Record findings separately for MIC product UX, BMAD integration, and the TTS feature.

## Acceptance criteria

- The original TTS Brief is available but does not dominate the workspace.
- Exactly one current stage and one primary action are shown at each checkpoint.
- No generic workflow dropdown appears in the guided path.
- Spec feedback returns to the new revision; acceptance reveals Story Breakdown without starting it unexpectedly.
- Story Breakdown produces a visible ordered inventory without a premature `stories.yaml` error.
- Activity and artifacts open in visible bounded workspaces at desktop and 390 px.
- The first story cannot start without valid parent context and explicit dispatch.
- TTS `main` is unchanged until final integration is explicitly accepted.

## Exit and review

Michael gives separate verdicts on:

- whether MIC now explains and guides the delivery journey;
- whether expert override remains sufficient;
- whether the BMAD artifact and approval flow is trustworthy;
- whether TTS implementation may continue through the redesigned control plane.

Only after UX acceptance does the original TTS feature validation continue to final implementation review and integration.
