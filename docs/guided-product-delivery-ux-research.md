# Guided Product Delivery UX Research

Status: working product model for the UX recovery epic

Terminology in this research is governed by the canonical [Scrum and Product Terminology](./scrum-and-product-terminology.md).

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

A durable customer-visible capability or behavior of the Product. MIC treats Features as first-class product objects with their own lifecycle and links to Product Goals, Briefs, backlog items, Epics, evidence, and Increments. A Feature remains after an Epic closes and may be changed by many Epics over time.

Feature is a deliberate MIC product-management extension rather than a formal Scrum artifact. It must not become compulsory process: a Brief may update an existing Feature, propose a new Feature, describe a defect, trigger research, or require no Feature change at all.

### Epic and story

An Epic is one coherent outcome requiring several bounded Build sessions. It owns a spec, ordered stories, implementation evidence, and an epic retrospective. A Story is a buildable Product Backlog item with acceptance criteria and evidence.

### Sprint and Increment

A Sprint is a timebox with one Sprint Goal and selected ready backlog items. Its result is a usable Increment. It may primarily advance one epic, but the data model should not make Sprints children of Epics. BMAD `sprint-status.yaml` is used on the project-sized path; a spec-backed epic retains its native `stories.yaml` contract.

## Example classification

The TTS Application is the Product. Its active Product Goal could be “Enable people to consume long text comfortably by listening.” `Long-form text-to-speech playback` is a persistent Feature. The current request, `Build reliable paragraph-aware long-form playback`, is one bounded initiative that changes that Feature, so BMAD correctly treats it as a spec-backed Epic. Its Brief is the original long request, its current planning artifact is `SPEC.md`, and Story Breakdown will create its ordered backlog in `stories.yaml`. The Epic eventually closes; the Feature remains and can receive later Epics.

The MIC UX correction is larger. MIC is the Product; the Product Goal is that a user can understand and control BMAD delivery without knowing BMAD internals. The redesign spans the domain model, navigation, planning, conversations, artifact review, backlog, delivery, and responsive behavior, so it is a Product Initiative organized into the Epics linked below. Those Epics still need story refinement before actual Sprint Planning selects ready work around a Sprint Goal.

## Where Scrum, BMAD, and MIC align

- Scrum supplies the product and cadence model: a Product Goal orders one Product Backlog, Sprint Planning selects ready items around a Sprint Goal, and completed work contributes to a usable Increment.
- BMAD supplies adaptive discovery and delivery workflows. It deliberately changes planning depth according to the size and uncertainty of the requested outcome, then gives each implementation unit to one bounded Build session.
- MIC supplies the durable control plane around BMAD: repository isolation, resumable sessions, artifact revisions, human decisions, evidence, and integration history.
- The three approaches agree that work should be transparent, inspected against an outcome, corrected when evidence changes, and delivered in small usable pieces.

## Where BMAD differs from Scrum

- BMAD is a software-delivery method, not a complete product-management or Scrum system. Its artifacts begin around an intended change or project; it does not provide MIC's required persistent Product Goal and Feature layer.
- BMAD `sprint-planning` is primarily a readiness and tracking workflow that creates `sprint-status.yaml`. The file name does not establish a timeboxed Scrum Sprint with a Sprint Goal, selected Product Backlog items, and a resulting Increment.
- A BMAD spec-backed Epic uses `SPEC.md` and `stories.yaml` without `sprint-status.yaml`. Calling that story sequence a Sprint would erase a deliberate BMAD path distinction.
- BMAD's Epic Retrospective checks whether an Epic is complete and whether the next Epic may proceed. A Scrum Sprint Retrospective instead examines how the Scrum Team can improve quality and effectiveness for the next Sprint.
- BMAD's project-sized path, a MIC Project, and a Scrum Product are different scopes despite the shared word “project.” The UI must translate these explicitly.
- BMAD can create substantial planning artifacts and approval points. MIC must apply them adaptively so that documentation supports small working Increments instead of becoming a fixed waterfall stage chain.

## MIC product decisions arising from the comparison

1. Treat Product, Product Goal, persistent Feature, and Product Backlog as MIC product objects around BMAD rather than pretending BMAD already supplies them.
2. Treat a Brief as immutable intake evidence. Triage determines whether it proposes a Goal or Feature, changes an existing Feature, creates an Epic or smaller backlog item, or starts Research or Correction.
3. Keep Epics and Features independent: an Epic is bounded work and closes; a Feature is a lasting product capability that many Epics may change.
4. Do not nest Sprints beneath Epics. A Sprint selects ready backlog items, potentially from several Epics, around one Sprint Goal.
5. Label BMAD tracking as BMAD tracking unless MIC has explicit Sprint, Sprint Goal, selection, and Increment records.
6. Keep BMAD workflow names visible as provenance while the primary UI explains the product decision, artifact, and consequence in human terms.

## Product interaction principles

1. **One authoritative present state.** Every delivery page states where the work is, why, what needs attention, and what happens next from one server projection.
2. **Guided with an escape hatch.** The primary surface offers one recommended action. Valid alternatives and raw BMAD operations live under Advanced actions and explain their effects.
3. **Pull only valid work.** Controls are hidden or disabled until prerequisites are met. A user should not discover lifecycle rules from backend errors.
4. **Current value before historical input.** The header summarizes present progress. The original Brief, raw prompts, logs, hashes, and invalid revisions remain available through progressive disclosure.
5. **Artifacts carry decisions.** Review surfaces name the exact artifact, decision, source of truth, downstream effect, and feedback route.
6. **Stable places.** Products, delivery cases, stages, runs, and artifacts have route-backed URLs, human-readable slugs, breadcrumbs, and browser-history behavior.
7. **Bounded workspaces.** Chat, document review, logs, and history use their own scroll regions. Selecting an item always changes the visible, focused workspace.
8. **Inspect and adapt.** Each completed backlog item should produce or contribute to a usable Increment and evidence. Actual Sprints inspect progress toward a Sprint Goal; corrections update upstream sources and regenerate affected work.

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

## Product policy from the Scrum comparison

1. Before classification, the user-facing object is a **Brief**. **Start work** may be the creation action, but Work does not become another domain object. The internal Delivery Case container stays out of the primary product language.
2. Each Product has one active Product Goal. MIC retains proposed, achieved, and abandoned goals as history.
3. MIC models real Sprints as fixed timeboxes of one month or less, with a Sprint Goal, selected PBIs, a delivery plan, and resulting Increments. BMAD `stories.yaml` and `sprint-status.yaml` remain planning and tracking inputs; neither creates a Scrum Sprint by itself.
4. Every Product has an explicit Definition of Done. A completed Build or accepted artifact counts toward an Increment only when the resulting product work meets it.
5. Scrum accountabilities remain human accountabilities. MIC and BMAD assist the Product Owner and Developers but do not silently assume product authority. In a personal workflow one person may perform several accountabilities, and the UI must still identify which decision is being made.
6. Accepting a BMAD planning artifact records that exact decision and reveals the next recommended refinement or delivery action. The default policy does not silently start model work; optional automation may be added later with the same transparency and eligibility rules.
7. Artifact review uses the centre workspace with an optional distraction-free full-screen mode. This is a UX decision rather than a Scrum rule.
8. MIC distinguishes a Scrum Sprint Review and Sprint Retrospective from BMAD artifact approval and BMAD Epic Retrospective. The labels must always name the scope and purpose.

## Delivery plan

See the [Guided Product Delivery UX initiative](../roadmap/guided-product-delivery-ux/README.md) and its eight delivery Epics. These Epics must be refined into stories before actual Sprint Planning selects work around a Sprint Goal.
