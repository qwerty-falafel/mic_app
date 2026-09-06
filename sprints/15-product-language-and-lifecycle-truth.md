# Sprint 15 – Product Language and Lifecycle Truth

**Epic:** [Guided Product Delivery UX](./epic-guided-product-delivery-ux.md)

## Goal

Give MIC one product vocabulary and one server-owned account of where each delivery case is, why it is there, and what may happen next.

## Product increment

The API can describe Products, Product Goals, Briefs, classified delivery types, stages, decisions, recommended actions, eligible alternatives, and blocked prerequisites without the PWA inferring lifecycle state from file existence.

## Work

1. Record the terminology decision and map existing `projects`, `workstreams`, work items, sessions, artifacts, stories, approvals, and integrations onto it without destructive migration.
2. Add durable human-readable slugs for Products and delivery cases, with collision handling and immutable IDs retained internally.
3. Preserve the original intent as a Brief and add a concise current summary that can evolve without rewriting the Brief.
4. Represent delivery classification: Change, Epic, Product initiative, Research, or Correction, alongside the precise BMAD path.
5. Define path-specific stage templates for direct Build, spec-backed epic, project-sized work, and specialist work.
6. Build a lifecycle projection containing current stage, state, reason, attention target, recommended action, alternatives, prerequisites, and the transition each action causes.
7. Derive the projection from durable sessions, artifacts, reviews, story inventories, readiness, and integration events on the server.
8. Make ambiguous or contradictory evidence an explicit needs-attention state instead of selecting a stage heuristically.
9. Expose an action-eligibility endpoint and reject stale action tokens when the underlying state has changed.
10. Add migration and contract tests covering existing MIC and TTS records.

## Acceptance criteria

- The TTS delivery case reports `Specification review` from one projection and names its latest valid `SPEC.md` as the attention target.
- Its recommended action is review; Story Breakdown is described as the result of acceptance or next guided operation, not the current stage.
- `Read stories.yaml` is ineligible because no story inventory exists, with a human-readable prerequisite.
- Direct, epic, project-sized, and specialist fixtures produce distinct stage maps.
- Existing opaque IDs and audit references remain valid after slugs are added.
- No frontend rule needs to infer a stage from `hasSpec` or `hasStories`.

## Exit and review

Review the vocabulary and four projected journeys as JSON and a minimal diagnostic page before building navigation around them.
