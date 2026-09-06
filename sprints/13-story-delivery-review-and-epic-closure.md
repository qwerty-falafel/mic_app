# Sprint 13 – Story Delivery, Review and Epic Closure

**Epic:** [BMAD-native MIC PWA](./epic-bmad-native-mic.md)
**Depends on:** Sprint 12 BMAD-native PWA

## Goal

Complete the BMAD delivery surface so MIC can safely dispatch one planned unit, present its evidence and close an epic through native review workflows.

## Product increment

The PWA presents spec-backed and sprint-backed story inventories, runs one story with attended Build or Build Auto, guides human review, and closes completed work with a retrospective verdict.

## Work

1. Parse and render `stories.yaml`, BMAD story records and `sprint-status.yaml` using their native status vocabulary.
2. Select exactly one eligible story and pass its parent spec or sprint context to the chosen Build workflow.
3. Use attended `bmad-build` for risky, foundational or decision-setting units.
4. Permit `bmad-build-auto` only when the unit and required context satisfy its captured preflight contract.
5. Persist Build terminal status, commits, test evidence, review trail, deferred findings and follow-up recommendations.
6. Route blocked or decision-needed results into the attention inbox and start the documented recovery path.
7. Integrate `bmad-code-review` for additional review and `bmad-walkthrough` for human comprehension.
8. Present changes by concern, risk points and manual observations rather than raw file order alone.
9. Integrate `bmad-correct-course` when implementation evidence invalidates upstream plans.
10. Run `bmad-retrospective` against the complete epic inventory and show its acceptance verdict.
11. Validate optional `bmad-loop` ordered dispatch; expose it only if its real contract passes and the user explicitly enables it.
12. Preserve fast-forward checks and require explicit final integration into the base branch.

## Acceptance criteria

- Build Auto cannot receive an entire multi-story workstream or select its own next story.
- An attended Build and an unattended Build Auto each complete one synthetic story with correct parent context.
- Story status and evidence update without losing BMAD-authored fields.
- A blocked story retains its artifacts and offers the documented safe recovery route.
- Walkthrough presents purpose, concerns, risk points and manual verification steps.
- Retrospective rejects an epic with unfinished stories and produces an evidence-linked verdict when complete.
- Optional bmad-loop follows manifest order and cannot bypass review/resource gates.
- Final integration refuses a non-fast-forward base and never discards concurrent work.

## Exit and review

Michael drives a small synthetic multi-story epic through planning inventory, one attended Build, one automated Build, walkthrough and retrospective entirely in the PWA. Sprint 14 begins only after this rehearsal succeeds.
