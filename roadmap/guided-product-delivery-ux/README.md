# Product Initiative – Guided Product Delivery UX

**Product:** MIC
**Product Goal:** A user can understand, guide, review, and advance BMAD delivery without learning BMAD's internal commands or losing access to expert controls.
**Feature:** Guided product delivery — MIC's persistent capability for turning a Brief into transparent, controllable, evidence-backed delivery.
**Research:** [Guided Product Delivery UX Research](../../docs/guided-product-delivery-ux-research.md)
**Evidence source:** Historical Sprint 14 planning rehearsal and its recorded UX findings

## Problem

MIC exposes durable BMAD sessions, artifacts, reviews, stories, and Git isolation, but the PWA presents those capabilities as a long technical page. It has no authoritative lifecycle stage, no route-backed places, and no state-aware next action. The original Brief dominates every visit. The stage heading, numbered chips, generic workflow launcher, and story controls can contradict each other. Selecting an activity or artifact may render its result outside the viewport. Chat and history grow with the document. Invalid actions fail with backend errors instead of being prevented.

The result is a control plane that preserves evidence but does not help the Product Owner decide what to do.

## Outcome

MIC becomes a guided product-delivery workspace. A Product contains goals, repositories, backlog, and delivery cases. Each delivery case begins with a Brief, is classified into the appropriate BMAD path, and exposes one server-owned present state, one decision or recommended next action, and a transparent route to valid alternatives.

The interface uses human product language first and BMAD skill names as provenance. Expert users can override the guide through Advanced actions without bypassing prerequisites, approval boundaries, worktree isolation, or audit history.

## Product model

```text
Product
├── Product Goal and goal history
├── Features and capability lifecycle
├── Repositories
├── Product Backlog
├── Delivery Case
│   ├── Brief
│   ├── classification: Change | Epic | Product initiative | Research | Correction
│   ├── BMAD path and current stage
│   ├── artifacts and decisions
│   ├── workflow runs and conversations
│   └── stories and evidence where applicable
├── Sprint Backlog / BMAD tracking where applicable
└── usable Increments and integration history
```

Epics decompose into stories or other ready backlog items. Sprints pull ready backlog items around a Sprint Goal; they are not modeled as children of Epics. Spec-backed epics retain BMAD's `SPEC.md` plus `stories.yaml` flow. Project-sized work retains PRD/UX/architecture, epics and stories, readiness, and `sprint-status.yaml`.

## Experience principles

1. Show the current outcome, stage, reason, and required decision before history.
2. Offer one primary recommended action and explain its result.
3. Put other eligible operations under Advanced actions; explain or omit ineligible operations.
4. Use stable slugged URLs and breadcrumbs for every durable place.
5. Keep the original Brief, prompts, logs, hashes, and invalid revisions available through progressive disclosure.
6. Use bounded scroll regions for conversations, documents, logs, and history.
7. Bind every approval and feedback request to an exact revision and state the transition it causes.
8. Preserve the native differences between BMAD planning paths.
9. Prevent invalid actions in the UI and return local, actionable failure messages for races or external changes.
10. Validate every delivery increment through a usable browser journey rather than component presence alone.

## Principal journeys

### Start and classify work

The user opens a Product, creates a Brief, and receives a BMAD-supported classification and planning recommendation. They accept the guide or select another valid path from Advanced actions. MIC creates the isolated workspace only when an operation needs it.

### Resume ongoing work

Home and Product pages show the delivery type, current stage, attention state, progress, and next action. Opening the delivery case lands directly on its current task, not a generic launcher or the entire original Brief.

### Review planning

The current document opens in the centre review workspace. The user sees why it needs review, what acceptance unblocks, relevant assumptions and changes, and concise feedback guidance. Historical revisions and provenance stay available without crowding the decision.

### Continue a conversation

A run opens at a stable URL in a bounded chat workspace with a pinned header, scrollable transcript, collapsed orchestration context, and pinned composer when input is required. Logs and artifacts are separate tabs.

### Break down and deliver work

After planning acceptance, MIC recommends the correct native breakdown operation. It renders epics, stories, readiness, sprint tracking, and current delivery status from the path's actual artifacts. Exactly one eligible story is dispatched at a time unless an explicitly enabled, validated automation policy applies.

### Inspect, adapt, and integrate

Review, evidence, walkthrough, retrospective, and integration appear as guided stages. If evidence invalidates planning, Correct Course sends the user to the source artifact and shows affected downstream work.

## Success measures

- A first-time user can identify the current stage and next action for a seeded delivery case without opening documentation.
- No primary page presents two elements as the current stage.
- No visible primary action can deterministically fail because its artifact prerequisite has never existed.
- Browser Back, Forward, refresh, bookmarks, and direct links preserve location and selection.
- Selecting an activity or artifact makes its content immediately visible and focused at desktop and 390 px width.
- The original TTS Brief occupies no more than a compact summary until expanded.
- Conversations and documents scroll inside bounded workspaces rather than extending the full application page.
- Spec-backed and project-sized paths show different, correct stage maps and artifacts.
- A user can complete planning feedback, artifact acceptance, story breakdown, one-story dispatch, review, and final integration through the guided path.
- Advanced actions remain available and audited without weakening eligibility or approval rules.

## Non-goals

- Implementing every formal Scrum event or replacing a team collaboration product.
- Adding estimation, velocity, time tracking, or capacity forecasting before real user need is established.
- Rewriting BMAD workflows or inventing artifact contracts BMAD does not produce.
- Styling polish without information-architecture or interaction value.
- Resuming TTS feature implementation before the new planning-review journey is usable.

## Delivery epics

These are backlog structure, not a Sprint schedule. Each epic must be refined into stories. Actual Sprints later select ready stories across these epics around one Sprint Goal.


1. [Epic 01 – Product Language and Lifecycle Truth](./epic-01-product-language-and-lifecycle-truth.md)
2. [Epic 02 – Route-backed Application Shell](./epic-02-route-backed-application-shell.md)
3. [Epic 03 – Guided Delivery Workspace](./epic-03-guided-delivery-workspace.md)
4. [Epic 04 – Planning and Artifact Decisions](./epic-04-planning-and-artifact-decisions.md)
5. [Epic 05 – Conversations, Runs, and Activity](./epic-05-conversations-runs-and-activity.md)
6. [Epic 06 – Backlog, Epics, Stories, and Sprint Tracking](./epic-06-backlog-epics-stories-and-sprint-tracking.md)
7. [Epic 07 – Responsive Recovery and Journey Validation](./epic-07-responsive-recovery-and-journey-validation.md)
8. [Epic 08 – TTS Guided-flow Acceptance](./epic-08-tts-guided-flow-acceptance.md)

## Initiative exit

The TTS delivery case resumes at its existing valid planning checkpoint in the redesigned PWA. Michael can understand its current state, review or revise the spec, trigger the correct breakdown, inspect its stories, and advance one story without seeing a raw operation dropdown or an invalid prerequisite action. The final evidence separates MIC UX acceptance from TTS feature acceptance.
