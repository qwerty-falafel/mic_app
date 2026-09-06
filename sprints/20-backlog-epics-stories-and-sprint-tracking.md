# Sprint 20 – Backlog, Epics, Stories, and Sprint Tracking

**Epic:** [Guided Product Delivery UX](./epic-guided-product-delivery-ux.md)
**Depends on:** Sprint 19 conversation workspace

## Goal

Present implementable work through a product and BMAD-correct backlog rather than exposing story parsing and dispatch controls before they apply.

## Product increment

Products show goals and ordered backlog. Delivery cases show their native decomposition: spec-backed epics use ordered stories; product initiatives use shared planning artifacts, epics, readiness, and BMAD sprint tracking. Story execution remains bounded and guided.

## Work

1. Add Product Goal and goal-history surfaces with links from delivery cases and increments.
2. Build a Product Backlog view that can contain changes, features, epics, stories, research, and corrections without requiring every optional level.
3. For spec-backed epics, render `SPEC.md` and `stories.yaml` as the epic contract and ordered implementation plan.
4. For project-sized paths, render PRD/UX/architecture, epics and stories, readiness findings, and `sprint-status.yaml` according to BMAD's native flow.
5. Model Sprint Goal, selected backlog items, status, and Increment only if explicit Sprint records are enabled; do not infer a Scrum Sprint merely from an epic story list.
6. Replace **Read stories.yaml** with the guided **Create story plan** action before breakdown and the rendered story inventory after breakdown.
7. Show dependencies, acceptance criteria, readiness, evidence, review state, and recommended next story.
8. Dispatch exactly one eligible story to attended Build or Build Auto, explaining why the recommended mode fits.
9. Keep advanced dispatch and future automation policies subject to the same eligibility projection.
10. Present epic progress and sprint/tracking progress separately so the two concepts cannot be confused.

## Acceptance criteria

- Before Story Breakdown, no control attempts to read a nonexistent `stories.yaml`.
- After breakdown, the TTS epic displays its ordered stories and one recommended next story.
- Spec-backed epic UI does not claim that `sprint-status.yaml` or a Scrum Sprint exists.
- Project-sized fixture UI shows epics, readiness, and BMAD sprint tracking without flattening them into the spec-backed flow.
- A Sprint, where explicitly modeled, has a Sprint Goal and selected backlog items and is not nested under an Epic in the domain model.
- Build Auto cannot receive a whole epic or choose its own next story.

## Exit and review

Compare one direct change, one spec-backed epic, and one project-sized delivery side by side; each must show the correct decomposition, tracking artifact, and next action.
