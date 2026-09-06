# Epic 06 – Backlog, Epics, Stories, and Sprint Tracking

**Initiative:** [Guided Product Delivery UX](./README.md)
**Depends on:** Epic 05 conversation workspace

## Goal

Present implementable work through a product and BMAD-correct backlog rather than exposing story parsing and dispatch controls before they apply.

## Product increment

Products show one active Product Goal, an ordered Product Backlog, and a Definition of Done. Delivery cases show their native BMAD decomposition and tracking. MIC separately models real Sprints with a Sprint Goal, selected PBIs, a delivery plan, and resulting usable Increments. Story execution remains bounded and guided.

## Work

1. Add Product Goal and goal-history surfaces with links from Features, delivery cases, backlog items, and Increments.
2. Build a persistent Feature map showing which capabilities exist, which Product Goal they support, and which Epics have changed or are changing them.
3. Build a Product Backlog view containing changes, Epics, stories, defects, research, and corrections, linked to affected Features without requiring every optional level.
4. For spec-backed epics, render `SPEC.md` and `stories.yaml` as the epic contract and ordered implementation plan.
5. For project-sized paths, render PRD/UX/architecture, epics and stories, readiness findings, and `sprint-status.yaml` according to BMAD's native flow.
6. Model fixed Sprint timeboxes of one month or less, each with one Sprint Goal, selected PBIs, an evolving delivery plan, status, and resulting Increments.
7. Replace **Read stories.yaml** with the guided **Create story plan** action before breakdown and the rendered story inventory after breakdown.
8. Show dependencies, acceptance criteria, readiness, evidence, review state, and recommended next story.
9. Dispatch exactly one eligible story to attended Build or Build Auto, explaining why the recommended mode fits.
10. Keep advanced dispatch and future automation policies subject to the same eligibility projection.
11. Add a Product-level Definition of Done and record which completed PBIs satisfy it and therefore form an Increment.
12. Present Feature health, Epic progress, Scrum Sprint progress, and BMAD tracking separately so the concepts cannot be confused.
13. Represent Sprint Planning, Sprint Review, and Sprint Retrospective by their Scrum purposes; keep Daily Scrum support lightweight while preserving inspection and adaptation of the Sprint plan.

## Acceptance criteria

- Before Story Breakdown, no control attempts to read a nonexistent `stories.yaml`.
- After breakdown, the TTS epic displays its ordered stories and one recommended next story.
- Spec-backed epic UI does not claim that `sprint-status.yaml` or a Scrum Sprint exists.
- Project-sized fixture UI shows epics, readiness, and BMAD sprint tracking without flattening them into the spec-backed flow.
- A Sprint, where explicitly modeled, has a Sprint Goal and selected backlog items and is not nested under an Epic in the domain model.
- Every claimed Increment identifies the applicable Definition of Done and the completed PBIs it contains.
- BMAD Sprint Planning and Epic Retrospective remain visibly distinct from Scrum Sprint Planning and Sprint Retrospective.
- Build Auto cannot receive a whole epic or choose its own next story.

## Exit and review

Compare one direct change, one spec-backed epic, and one project-sized delivery side by side; each must show the correct decomposition, tracking artifact, and next action.
