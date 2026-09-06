# Epic 01 – Product Language and Lifecycle Truth

**Initiative:** [Guided Product Delivery UX](./README.md)

## Goal

Give MIC one product vocabulary and one server-owned account of where each delivery case is, why it is there, and what may happen next.

## Product increment

The API can describe Products, Product Goals, persistent Features, Briefs, classified delivery types, stages, decisions, recommended actions, eligible alternatives, and blocked prerequisites without the PWA inferring lifecycle state from file existence.

## Work

1. Record the terminology decision and map existing `projects`, `workstreams`, work items, sessions, artifacts, stories, approvals, and integrations onto it without destructive migration.
2. Add first-class Features as durable product capabilities linked to goals, Briefs, Epics, evidence, and Increments; closing an Epic must not close its Feature.
3. Add durable human-readable slugs for Products, Features, and delivery cases, with collision handling and immutable IDs retained internally.
4. Preserve the original intent as a Brief and add a concise current summary that can evolve without rewriting the Brief.
5. Represent delivery classification: Change, Epic, Product initiative, Research, or Correction, alongside the precise BMAD path and affected Features.
6. Define path-specific stage templates for direct Build, spec-backed epic, project-sized work, and specialist work.
7. Build a lifecycle projection containing current stage, state, reason, attention target, recommended action, alternatives, prerequisites, and the transition each action causes.
8. Derive the projection from durable sessions, artifacts, reviews, story inventories, readiness, and integration events on the server.
9. Make ambiguous or contradictory evidence an explicit needs-attention state instead of selecting a stage heuristically.
10. Expose an action-eligibility endpoint and reject stale action tokens when the underlying state has changed.
11. Add migration and contract tests covering existing MIC and TTS records.

## Acceptance criteria

- The TTS delivery case reports `Specification review` from one projection and names its latest valid `SPEC.md` as the attention target.
- Its recommended action is review; Story Breakdown is described as the result of acceptance or next guided operation, not the current stage.
- `Read stories.yaml` is ineligible because no story inventory exists, with a human-readable prerequisite.
- Direct, epic, project-sized, and specialist fixtures produce distinct stage maps.
- Existing opaque IDs and audit references remain valid after slugs are added.
- The TTS Epic links to a persistent Long-form TTS Feature, and completing the Epic leaves that Feature active in the Product.
- No frontend rule needs to infer a stage from `hasSpec` or `hasStories`.

## Exit and review

Review the vocabulary and four projected journeys as JSON and a minimal diagnostic page before building navigation around them.
