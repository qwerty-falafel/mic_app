# Sprint 09 – BMAD Catalog and Workstream Core

**Epic:** [BMAD-native MIC PWA](./epic-bmad-native-mic.md)
**Depends on:** Sprint 08 contract report

## Goal

Replace MIC's planning/implementation abstraction with a durable model that discovers installed BMAD capabilities and can represent multiple native development paths.

## Product increment

The API and a minimal diagnostic view show the attached repository's BMAD installation, available modules and skills, configured artifact locations, active workstreams and valid workflow-start actions.

## Work

1. Add durable entities for workstreams, workflow definitions, workflow sessions, conversation turns, artifact revisions, artifact relationships and review decisions.
2. Migrate projects, repositories, runs, questions, approvals and audit history without deleting prior records.
3. Treat legacy work-item lifecycle state as imported history rather than the authority for new workstreams.
4. Parse `_bmad/_config/bmad-help.csv`, installed skill manifests and merged configuration for each repository.
5. Fingerprint an installation so reinstalling or changing modules refreshes the catalog safely.
6. Resolve team and user configuration using BMAD's precedence rules and show the effective project name, output paths and user settings.
7. Replace the two-mode adapter contract with generic `{ skill, action, args, prompt, repository, workspace }` dispatch.
8. Model MIC execution status separately from BMAD workflow and artifact status.
9. Add API queries for catalog, project BMAD health, workstreams, sessions and valid next operations.
10. Record every mutation through the existing audit and outbox mechanism.

## Acceptance criteria

- MIC lists the actual installed skills and their metadata without a hard-coded BMAD skill list.
- Adding or removing an installed module changes the discovered catalog after refresh.
- A generic runner can invoke two different non-build skills by name in an isolated scratch worktree.
- New workstreams do not require the legacy fixed lifecycle enum.
- Legacy MIC and TTS records remain queryable with their original provenance.
- Effective BMAD configuration points at the attached repository and its artifact directories.
- Invalid or unavailable skill requests fail before a model run begins.
- Migration and restart tests demonstrate no history loss.

## Exit and review

Demonstrate catalog discovery and generic skill dispatch against a scratch repository. Michael reviews the new domain model and migration report before interactive workflow persistence begins.
