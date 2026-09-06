# Sprint 11 – Artifact Intelligence and Native Review

**Epic:** [BMAD-native MIC PWA](./epic-bmad-native-mic.md)
**Depends on:** Sprint 10 durable sessions

## Goal

Make BMAD artifacts, relationships, validation and revision-specific human decisions first-class parts of MIC.

## Product increment

The PWA renders planning and delivery artifacts in-app, shows how they relate, compares revisions, highlights assumptions and open questions, and returns feedback to the workflow that owns the document.

## Work

1. Index files under BMAD's resolved planning, implementation, spec and project-context locations.
2. Parse Markdown frontmatter, memlogs, companion declarations, `stories.yaml`, sprint status, findings and terminal result fields.
3. Record artifact type, owning skill/session, content hash, Git revision, status, sources and consumers.
4. Build an artifact relationship graph and freshness checks when an upstream revision changes.
5. Enforce captured invariants, including append-only memlogs, required artifact pairs, recognized statuses and exact story identifiers.
6. Quarantine invalid outputs instead of advancing downstream work.
7. Render Markdown and structured YAML with raw-source and download access.
8. Add revision comparison and a readable decision/open-question summary.
9. Bind review, feedback, acceptance, rejection or override to an exact artifact revision.
10. Route feedback to the artifact's owning BMAD workflow as an update or validation run.
11. Build the unified attention inbox for workflow questions, review requests, readiness concerns and blocked outcomes.

## Acceptance criteria

- A spec, architecture spine, story inventory and sprint status render correctly from captured fixtures.
- The PWA shows source-to-consumer relationships and identifies a stale dependent after an upstream change.
- A modified historical memlog entry fails validation and cannot be treated as a valid new revision.
- Feedback creates a new owning-workflow session and leaves the reviewed revision immutable.
- An older revision cannot satisfy a review decision intended for a newer revision.
- Assumptions, open questions and conflicts are visible without reading raw adapter logs.
- The artifact index can be rebuilt from files and run provenance after database loss in a scratch environment.

## Exit and review

Michael reviews, rejects, revises and accepts a sample artifact through the PWA, then verifies the artifact graph and audit trail show the complete history.
