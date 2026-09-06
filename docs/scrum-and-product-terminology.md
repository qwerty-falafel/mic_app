# Scrum and Product Terminology

**Status:** Canonical terminology for MIC product design, implementation, prompts, documentation, and UI copy.

This document separates formal Scrum concepts from MIC product-management extensions and BMAD delivery terms. Future changes must preserve these distinctions even when legacy database or workflow names cannot yet be migrated.

## The three dimensions

MIC must not collapse these into one hierarchy:

1. **Product structure** describes what exists, what it should become, and its lasting capabilities.
2. **Work structure** describes bounded initiatives and backlog items used to change the Product.
3. **Execution cadence** describes when selected work is undertaken and the outcome of that timebox.

```text
PRODUCT                      WORK                         CADENCE

Product                      Brief                        Sprint
├── active Product Goal      └── triage/refinement        ├── Sprint Goal
└── persistent Features          ├── Change                ├── selected PBIs
                                  ├── Epic                  ├── delivery plan
                                  │   └── Stories           └── Increment(s)
                                  ├── Defect
                                  └── Research

                     All ordered in one Product Backlog
```

## Formal Scrum terms

The terms in this section follow the [Scrum Guide](https://scrumguides.org/scrum-guide.html). Scrum does not prescribe Features, Epics, user-story syntax, story points, or a Brief.

### Product

A vehicle for delivering value. It has a clear boundary, known stakeholders, and defined users or customers. The Product persists while individual pieces of work begin and end.

MIC currently stores this concept under the legacy entity name `project`. The product-facing UI should say **Product** where that is the intended meaning.

### Product Goal

The future state of the Product that serves as the long-term objective for the Scrum Team. It is the commitment for the Product Backlog.

A Scrum Team pursues one Product Goal at a time and must fulfil or abandon it before taking on the next. MIC may preserve proposed, achieved, and abandoned goals as history while clearly identifying the active goal.

### Product Backlog

The emergent, ordered list of what is needed to improve the Product. It is the single source of work undertaken by the Scrum Team.

Its entries are **Product Backlog Items** or **PBIs**. MIC may use stories, defects, research, technical work, Changes, and decomposed parts of Epics as PBIs. Optional organization must not turn the backlog into a mandatory hierarchy.

Product Backlog refinement is the ongoing activity of breaking down and further defining PBIs. It is not a separate formal Scrum event.

### Sprint

A fixed-length event of one month or less in which ideas are turned into value. A new Sprint starts immediately after the previous Sprint concludes.

A Sprint is not a child of an Epic. An Epic can span several Sprints, and one Sprint can select PBIs associated with several Epics when they support one Sprint Goal.

### Sprint Goal

The single objective for the Sprint and the commitment for the Sprint Backlog. It explains why the Sprint is valuable while allowing flexibility in the exact work needed to achieve it.

### Sprint Backlog

The Sprint Goal (**why**), the Product Backlog Items selected for the Sprint (**what**), and an actionable plan for delivering the Increment (**how**). It is a plan by and for the Developers and is updated as the team learns.

### Increment

A concrete, usable step toward the Product Goal. Each Increment is additive to prior Increments, thoroughly verified, and usable. Multiple Increments may be created within a Sprint and may be delivered before the Sprint ends; the Sprint Review is not a release gate.

### Definition of Done

The formal description of the state of an Increment when it meets the quality measures required for the Product. It creates shared transparency. Work that does not meet the Definition of Done is not part of an Increment and returns to the Product Backlog for future consideration.

### Scrum Team and accountabilities

One Scrum Team consists of a Product Owner, Scrum Master, and Developers, with no sub-teams or hierarchies inside it.

- The **Product Owner** is accountable for maximizing Product value and effective Product Backlog management. MIC can assist, but consequential product decisions remain human-owned unless explicitly delegated.
- The **Scrum Master** is accountable for establishing Scrum and improving the Scrum Team's effectiveness.
- **Developers** are accountable for creating a usable Increment each Sprint, planning the Sprint Backlog, adapting their plan daily, and maintaining quality through the Definition of Done.

BMAD agents and MIC automation can perform activities, but MIC must not silently present software agents as holding human Scrum accountabilities.

### Scrum events

- **Sprint Planning:** establishes why the Sprint is valuable, what can be done, and how the selected work will be accomplished.
- **Daily Scrum:** Developers inspect progress toward the Sprint Goal and adapt the Sprint Backlog.
- **Sprint Review:** the Scrum Team and stakeholders inspect the Sprint outcome and adapt what to do next. It is a working session, not merely a presentation or approval gate.
- **Sprint Retrospective:** the Scrum Team plans ways to improve quality and effectiveness.

The Sprint contains all four events. MIC need not implement every event to use Scrum terminology correctly, but it must not claim full Scrum support for events it does not model.

## MIC product and work terms

These terms are useful MIC extensions. They are not additional formal Scrum artifacts.

### Feature

A persistent, customer-visible capability or behavior of the Product. It answers, “What can the Product do?”

A Feature may be introduced by one Epic and improved by many later Epics. Closing an Epic does not close the Feature. Features can link to Product Goals, Briefs, Epics, PBIs, evidence, and Increments, but they are optional organization rather than a compulsory level in every item.

### Brief

The immutable original account of a problem, opportunity, desired outcome, evidence, and constraints submitted for consideration. It is intake evidence, not the live status summary or automatically an implementation specification.

Triage and refinement may turn a Brief into a small Change, one or more Epics, Research, a correction, a Product Goal proposal, a Feature proposal, or PBIs affecting existing Features.

### Product Initiative

A coordinated body of product change spanning multiple Epics or shared product artifacts. It organizes a substantial outcome but is not a Scrum Sprint and does not prescribe a timebox.

### Epic

A bounded initiative intended to make a coherent, substantial change to the Product. It has a beginning and an end and may create one Feature, improve existing Features, or affect several Features.

An Epic is work structure. It normally decomposes into smaller PBIs or Stories. It is not a parent of Sprints.

### Story

A small, valuable, independently testable PBI, often associated with an Epic. User-story phrasing can be useful but is not required by Scrum. A BMAD Build session should receive one bounded implementation unit rather than an entire Epic.

### Change, Defect, and Research

- A **Change** is a bounded product or technical modification that may fit one Build session.
- A **Defect** describes behavior that fails an accepted expectation.
- **Research** or a **Spike** reduces material uncertainty and should produce a finding or decision rather than masquerading as a guaranteed product Increment.

### Work item

A generic interface phrase, not a formal Scrum artifact. When precision matters, MIC should say **Product Backlog Item** for ordered potential work, or use the classified type such as Change, Epic, Story, Defect, or Research. It should say **Delivery Case** only when referring to the durable MIC control-plane container.

### Delivery Case

MIC's provisional neutral term for the durable control-plane container currently stored as a `workstream`. It connects the Brief, classification, BMAD path, sessions, artifacts, decisions, implementation evidence, and integration outcome.

The UI should normally show its classified human type—Change, Epic, Product Initiative, Research, or Correction—rather than expose `workstream` as product methodology.

## BMAD translation rules

BMAD provides adaptive software-planning and delivery workflows. MIC wraps those workflows with durable state, review, repository isolation, evidence, and human control. BMAD terminology does not override the Scrum definitions above.

### Direct Build

Use for one clear, bounded implementation unit. It need not be presented as an Epic or Sprint.

### Spec-backed Epic

Uses `SPEC.md`, followed by an ordered `stories.yaml`, then one Build session per Story. This path deliberately has no `sprint-status.yaml`. Its ordered stories are not automatically a Scrum Sprint.

### Project-sized BMAD path

Uses broader product, UX, and architecture planning before Epics and Stories, readiness checks, and BMAD Sprint Planning. BMAD's word `project` describes planning scale; it is not automatically identical to a MIC Product or Scrum Product.

### BMAD Sprint Planning and `sprint-status.yaml`

BMAD Sprint Planning provides implementation-readiness and status tracking. MIC must label it as **BMAD tracking** unless MIC also records an explicit Sprint timebox, Sprint Goal, selected PBIs, delivery plan, and resulting Increment.

### BMAD Epic Retrospective

BMAD uses this workflow to evaluate an Epic and readiness for subsequent work. It is not a Scrum Sprint Retrospective. MIC must name the scope being reviewed.

### Artifacts and approvals

BMAD planning artifacts are sources for downstream work. MIC binds feedback and acceptance to exact immutable revisions. Approval means the named artifact is accepted for its stated downstream purpose; it must not be described as accepting an entire Sprint, Feature, or Product unless that is the actual decision.

## Relationship rules

These are product invariants for MIC:

1. A Product has one active Product Goal and may retain goal history.
2. A Product has one ordered Product Backlog.
3. Features describe persistent Product capabilities; Epics describe temporary work.
4. A Brief is interpreted and refined; it is not automatically a Goal, Feature, Epic, or Story.
5. An Epic may change several Features, and a Feature may be changed by several Epics.
6. Epics may decompose into Stories or other PBIs.
7. Sprints select ready PBIs around one Sprint Goal; they are not nested beneath Epics.
8. A PBI can be viewed simultaneously through its Feature impact, Epic scope, and Sprint selection.
9. Completed work contributes to a usable Increment only when it meets the Definition of Done.
10. File names and legacy database entities do not determine product meaning.
11. “Work item” is generic UI language and must not hide whether the object is a PBI, Epic, Story, or Delivery Case when that distinction affects the workflow.

The misleading hierarchy is:

```text
Product Goal → Feature → Epic → Sprint
```

The accurate relationship is:

```text
PRODUCT VIEW              WORK VIEW                 EXECUTION VIEW

Product                   Epic A                    Sprint 1
├── Product Goal          ├── Story A1 ────────────┤ Goal: X
└── Features              └── Story A2              ├── Story A1
                          Epic B                    └── Story B1
                          ├── Story B1 ────────────┐
                          └── Story B2             Sprint 2
                                                  ├── Goal: Y
                                                  ├── Story A2
                                                  └── Story B2
```

## TTS example

```text
Product:
TTS Application

Active Product Goal:
Enable people to comfortably consume long-form text by listening.

Persistent Feature:
Long-form text-to-speech playback.

Brief:
Allow arbitrarily long input, begin playback after the first bounded chunk,
and prepare later chunks in order without stale audio.

Epic:
Build reliable paragraph-aware long-form playback.

Possible Stories:
- Select lossless text chunks within the real service limit.
- Begin playback without waiting for all synthesis.
- Prefetch and consume audio in source order.
- Prevent results from an old reading session from playing.
- Surface later-chunk failures and preserve cancellation behavior.
```

The Epic eventually closes. The Feature remains. If MIC later uses timeboxed Sprints, ready Stories are selected because they support a Sprint Goal, not because the Sprint sits underneath this Epic.

## Sources

- [The Scrum Guide, November 2020](https://scrumguides.org/scrum-guide.html)
- [BMAD: Choose a planning path](https://docs.bmad-method.org/cs/plan/choose-a-planning-path/)
- [BMAD: Break work into stories and track it](https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/)
- [BMAD: Plan inside an organization](https://docs.bmad-method.org/cs/plan/plan-inside-an-organization/)
