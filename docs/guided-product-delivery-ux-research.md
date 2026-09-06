# Guided Product Delivery UX Research

Status: working product model for the UX recovery epic

## Why this review exists

MIC currently exposes BMAD sessions and files, but it does not explain the product outcome, current decision, permitted action, or next stage as one coherent journey. The TTS rehearsal showed contradictions between the stage heading, numbered chips, generic workflow launcher, artifact rail, and story controls. This note grounds the correction in Scrum, Agile, Lean, and BMAD rather than preserving MIC's accidental vocabulary.

## Sources and findings

The [2020 Scrum Guide](https://scrumguides.org/scrum-guide.html) defines a Product as a vehicle for delivering value. Its Product Goal describes a future state, and its Product Backlog is the emergent ordered list of what is needed to improve the product. Sprint Planning chooses a Sprint Goal, Product Backlog items, and an actionable plan. A Sprint produces a usable Increment that meets the Definition of Done.

Scrum does not prescribe features, epics, user stories, or tasks as additional artifacts. Those are useful refinement patterns, but MIC must not present them as a mandatory Scrum hierarchy. In particular, an epic is normally decomposed into backlog items or stories; a Sprint is a timebox that pulls ready items toward one Sprint Goal. A Sprint is not intrinsically a child of an epic.

The [Agile Manifesto principles](https://agilemanifesto.org/principles.html) emphasize early and continuous valuable delivery, welcoming changing requirements, frequent working software, sustainable work, technical excellence, simplicity, and regular reflection. MIC should therefore prefer usable increments and feedback over long chains of documents whose purpose is unclear.

The Lean Enterprise Institute's [Lean Thinking and Practice](https://www.lean.org/lexicon-terms/lean-thinking-and-practice/) describes value from the customer's perspective, the value stream, flow, pull, and continuous improvement. In MIC this means showing only work that the current state can pull, removing invalid or premature controls, and keeping operational provenance available without putting it in the user's primary path.

BMAD's [planning-path guidance](https://docs.bmad-method.org/cs/plan/choose-a-planning-path/) sizes the method to the intent:

- a clear change that fits one implementation session goes to Build;
- one coherent outcome requiring several Build sessions is a spec-backed epic;
- a product or multi-epic initiative uses the fuller PRD, UX, architecture, epics, and stories path;
- every implementation unit is still one bounded Build session.

BMAD's [story and tracking guidance](https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/) distinguishes two real contracts. A spec-backed epic uses `SPEC.md` and an ordered `stories.yaml`, with no `sprint-status.yaml`. A project-sized path creates epics and stories, gates readiness, and then uses Sprint Planning to generate `sprint-status.yaml`. MIC must preserve this distinction instead of drawing one universal timeline.

BMAD's [organizational planning guidance](https://docs.bmad-method.org/cs/plan/plan-inside-an-organization/) identifies artifact ownership and named sign-off moments. Feedback must update the correct source artifact and regenerate dependants. MIC should explain what a review decides and exactly what it unblocks.

## Proposed product vocabulary

### Product

A long-lived vehicle for delivering value, currently stored as a MIC `project`. Examples are MIC and the TTS Application. A Product owns repositories, goals, backlog, increments, and delivery history.

### Product Goal

A measurable future state of the Product. Goal history may contain proposed, active, achieved, and abandoned goals. MIC should emphasize the active goal and progress toward it rather than treating every incoming request as another product goal.

### Brief

The user's original account of a problem, opportunity, desired outcome, evidence, and constraints. It is intake evidence, not the live status summary and not automatically a specification. The full Brief remains accessible and immutable while a concise current summary replaces it in the page header.

### Delivery Case

Provisional neutral name for the durable container currently stored as a `workstream`. Triage classifies a Delivery Case as:

- **Change** — one bounded Build session;
- **Epic** — one coherent outcome, a spec, and several stories/Build sessions;
- **Product initiative** — coordinated work spanning multiple epics and shared product artifacts;
- **Research or correction** — a specialist path that may update backlog or planning artifacts.

The UI should normally display the classified type, such as `Epic: Long-form TTS reading`, rather than the implementation term Delivery Case. The neutral term can remain internal or appear before classification.

### Feature

A customer-visible capability or behavior. It can be a Product Backlog item, label, or grouping depending on scale. Because neither Scrum nor BMAD assigns Feature a fixed mandatory level, MIC should not force every Goal to contain Features or every Feature to contain Epics.

### Epic and story

An Epic is one coherent outcome requiring several bounded Build sessions. It owns a spec, ordered stories, implementation evidence, and an epic retrospective. A Story is a buildable Product Backlog item with acceptance criteria and evidence.

### Sprint and Increment

A Sprint is a timebox with one Sprint Goal and selected ready backlog items. Its result is a usable Increment. It may primarily advance one epic, but the data model should not make Sprints children of Epics. BMAD `sprint-status.yaml` is used on the project-sized path; a spec-backed epic retains its native `stories.yaml` contract.

## Example classification

The TTS Application is the Product. “Make long-form reading begin quickly and continue beyond 5,000 characters” can support a Product Goal or a Feature, depending on the owner's product strategy. The current implementation request is one coherent multi-session outcome, so BMAD correctly treats it as a spec-backed Epic. Its Brief is the original long request, its current planning artifact is `SPEC.md`, and Story Breakdown will create its ordered backlog in `stories.yaml`.

The MIC UX correction is larger. MIC is the Product; the Product Goal is that a user can understand and control BMAD delivery without knowing BMAD internals. The redesign spans the domain model, navigation, planning, conversations, artifact review, backlog, delivery, and responsive behavior, so it is a product initiative implemented as the epic and sprints linked below.

## Product interaction principles

1. **One authoritative present state.** Every delivery page states where the work is, why, what needs attention, and what happens next from one server projection.
2. **Guided with an escape hatch.** The primary surface offers one recommended action. Valid alternatives and raw BMAD operations live under Advanced actions and explain their effects.
3. **Pull only valid work.** Controls are hidden or disabled until prerequisites are met. A user should not discover lifecycle rules from backend errors.
4. **Current value before historical input.** The header summarizes present progress. The original Brief, raw prompts, logs, hashes, and invalid revisions remain available through progressive disclosure.
5. **Artifacts carry decisions.** Review surfaces name the exact artifact, decision, source of truth, downstream effect, and feedback route.
6. **Stable places.** Products, delivery cases, stages, runs, and artifacts have route-backed URLs, human-readable slugs, breadcrumbs, and browser-history behavior.
7. **Bounded workspaces.** Chat, document review, logs, and history use their own scroll regions. Selecting an item always changes the visible, focused workspace.
8. **Inspect and adapt.** Each sprint produces a usable increment and evidence; corrections update upstream sources and regenerate affected work.

## State model required by the UX

The server must project, for each Delivery Case:

- classified delivery type and BMAD path;
- current phase and current human-facing stage;
- stage state: not started, ready, active, awaiting decision, blocked, complete, or superseded;
- reason for the state and evidence used to derive it;
- one recommended next action;
- every currently eligible alternative action;
- prerequisites and reasons for ineligible actions;
- the artifact or conversation requiring attention;
- the transition caused by acceptance, feedback, completion, cancellation, or correction.

This projection cannot be reconstructed independently by React from “does a spec exist?” and “do stories exist?”. The backend owns lifecycle truth; the PWA renders it.

## Open product decisions

The epic proceeds with provisional choices, but the following questions remain for the Product Owner:

1. Should the neutral intake/execution container appear as **Work**, **Delivery**, or **Initiative** before BMAD classifies it as a Change, Epic, Product initiative, Research, or Correction?
2. Should MIC support explicit calendar/timeboxed Sprints now, or first present BMAD's existing `stories.yaml` and `sprint-status.yaml` faithfully while reserving the Scrum Sprint model for a later increment?
3. After a human accepts an artifact, should MIC only reveal the next recommended action, or may a per-delivery automation policy start selected low-risk transitions automatically?
4. Should document review replace the centre workspace or enter a distraction-free full-screen review route? The epic assumes a centre workspace with an optional full-screen mode.

## Delivery plan

See [Epic: Guided Product Delivery UX](../sprints/epic-guided-product-delivery-ux.md) and Sprints 15–22.
