# Sprint 18 – Planning and Artifact Decisions

**Epic:** [Guided Product Delivery UX](./epic-guided-product-delivery-ux.md)
**Depends on:** Sprint 17 guided workspace

## Goal

Make planning and review a clear decision about a named source artifact, with feedback routed to the correct owner and downstream consequences made explicit.

## Product increment

The centre workspace groups current planning artifacts by purpose, opens a readable review mode, and supports acceptance or revision feedback without exposing a flat history of files.

## Work

1. Group artifacts into current Plan, Decision history, Story plan, Architecture/UX, Implementation, Evidence, and History sections according to the selected path.
2. Show current valid revisions by default; move previous and quarantined revisions into History.
3. Treat `.memlog.md`, hashes, commits, relationships, and raw source as provenance revealed on demand.
4. Build a document review workspace with readable Markdown, table/list rendering, in-document navigation, and optional distraction-free mode.
5. State the exact question being decided, why the document is ready, what acceptance unblocks, and which source should receive feedback.
6. Show assumptions, conflicts, changes since the previous revision, validation, and related artifacts before the decision controls.
7. Separate **Accept this revision** from **Request changes**, with focused feedback prompts for change, preservation, and constraints.
8. After feedback, route directly to the resulting revision run and return to the new artifact when it finishes.
9. After acceptance, show the next guided action; do not silently start model work under the default policy.
10. Prevent acceptance of stale, invalid, or companion-inconsistent revisions at both UI and API layers.

## Acceptance criteria

- The current TTS spec is the obvious planning decision; `.memlog.md` and old quarantined revisions do not compete with it.
- The review explains that acceptance enables Story Breakdown and does not begin implementation.
- Requesting changes opens the owning `bmad-spec` run and returns to the resulting immutable revision.
- Review controls remain visible while the document scrolls.
- An old revision cannot be accepted and explains where the latest revision is.
- A correction that belongs in a parent PRD or architecture spine is routed upstream and marks affected dependants for regeneration.

## Exit and review

Michael completes one feedback round and accepts a corrected fixture artifact without opening raw activity history or losing the review location.
