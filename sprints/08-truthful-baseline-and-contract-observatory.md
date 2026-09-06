# Sprint 08 – Truthful Baseline and BMAD Contract Observatory

**Epic:** [BMAD-native MIC PWA](./epic-bmad-native-mic.md)

## Goal

Stop MIC from presenting unperformed BMAD work as complete, preserve the existing TTS experiment safely, and capture the real observable contracts needed to build the platform against BMAD 6.12 and GPT-OSS 120B.

## Product increment

The existing PWA remains usable for projects, repositories and system status, but cannot accidentally dispatch a whole work-item intent to Build Auto. Unsupported transitions explain what capability is still being built. A contract report and reproducible fixtures describe real BMAD sessions and artifacts.

## Work

1. Add an audited `PAUSED` or equivalent recovery condition that preserves the TTS work item, its approval and its planning branch without treating it as ready to build.
2. Disable implementation dispatch unless it names a valid direct intent, spec path, or story identifier supported by Build/Build Auto.
3. Replace **Complete technical discovery** and similar false completion labels with the concrete operation performed or an unavailable-state explanation.
4. Inventory the installed modules, generated skills, version, configuration layers and output locations.
5. Build a repeatable scratch-repository harness that records command, prompt, conversation output, files before/after, frontmatter, exit status, terminal status, Git revisions and resource observations.
6. Capture representative contracts for:
   - `bmad-help`;
   - attended `bmad-build` through a plan decision;
   - `bmad-spec` create, update, validate and Story Breakdown;
   - `bmad-architecture`;
   - `bmad-create-epics-and-stories` interaction checkpoints;
   - `bmad-sprint-planning` PASS, CONCERNS and FAIL;
   - one folder-plus-story `bmad-build-auto` dispatch;
   - blocked, cancelled, interrupted and resumed execution;
   - `bmad-walkthrough` and `bmad-retrospective`.
7. Identify which facts are available in structured output, artifact frontmatter, files, conversation text and process telemetry.
8. Document every mismatch between installed behavior, online documentation and current MIC assumptions.

## Acceptance criteria

- Clicking through the current PWA cannot start Build Auto for the paused TTS work item.
- The TTS `main` branch remains at its baseline commit and clean.
- The corrective TTS state and reason are visible in the PWA and audit history.
- Contract captures are reproducible and contain no inferred success states.
- At least one interactive wait/resume and one blocked Build Auto result are captured from the real installed skills.
- The report identifies concrete persistence and UI requirements for Sprint 09 and Sprint 10.
- Existing kernel, API and worktree tests still pass.

## Exit and review

Michael reviews the contract report, the paused TTS state and a browser demonstration of the fail-closed controls. Sprint 09 starts only after the data model assumptions are accepted.
