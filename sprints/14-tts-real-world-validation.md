# Sprint 14 – TTS Real-world Platform Validation

**Epic:** [BMAD-native MIC PWA](./epic-bmad-native-mic.md)
**Depends on:** Sprint 13 synthetic epic acceptance

## Goal

Use MIC and the installed BMAD workflows to plan, implement and validate the long-form paragraph-aware TTS feature in `/home/michael/projects/tts-app`. This sprint validates the platform with real work; it must not bypass MIC to implement the feature.

## Starting conditions

- The TTS repository remains at its existing location and retains all prior work.
- Its base branch must be clean before the validation starts.
- The earlier MIC TTS experiment remains preserved as historical evidence and is not treated as valid implementation authority.
- A fresh BMAD-native workstream starts from the original intent and recorded user feedback.
- GPT-OSS 120B is the default model.

## Product increment

The TTS application accepts long text, selects high-quality bounded chunk boundaries, starts playback after the first useful synthesis, prepares later chunks with safe bounded concurrency, preserves order and session cancellation, and continues beyond the service request limit. Every planning and implementation action is performed and reviewable through MIC.

## Platform-validation flow

1. Attach or select the existing TTS project and verify Git/BMAD health in the PWA.
2. Run `bmad-project-context` setup or audit for the brownfield repository.
3. Ask `bmad-help` to recommend the development path from the complete feature intent.
4. Expect a spec-backed epic unless BMAD's evidence supports another path; record the recommendation and user choice.
5. Create a fresh or corrected `SPEC.md` and verify every load-bearing chunking, playback, cancellation, error and testing requirement is preserved.
6. Exercise artifact feedback and revision through the owning `bmad-spec` workflow.
7. Run Story Breakdown and review the resulting ordered `stories.yaml` and checkpoints.
8. Use attended Build for the first architectural or pattern-setting story.
9. Run later stories one unit at a time, using Build Auto only after decisions and dispatch contracts are stable.
10. Surface all blocked questions and corrections through MIC.
11. Run BMAD's built-in review, relevant repository tests, optional extra code review and a guided walkthrough.
12. Run the spec-backed epic retrospective and obtain an evidence-based verdict.
13. Stop for Michael's final feature and platform acceptance before integrating the branch.

## TTS feature acceptance

- Short input remains one request.
- In each search window, paragraph boundaries outrank sentence boundaries.
- The 2,000–3,000 window is exhausted before searching 3,000–4,000, then the range up to the real service maximum.
- A sentence near 2,100 does not beat a paragraph near 2,700 in the same window.
- A sentence near 2,500 does beat a paragraph near 3,100 because the earlier window wins.
- Punctuation-free text is split safely without exceeding the real request limit.
- Recombining chunks reproduces the input exactly with no loss, duplication or reordering.
- First audio can start without waiting for every later synthesis.
- Completed audio plays in source order.
- Starting a new session prevents stale results from playing.
- Existing stop/reset behavior remains coherent and later synthesis errors are visible.
- Michael can paste and continuously play a document longer than 5,000 characters.

## Platform acceptance evidence

- path recommendation and selection;
- complete session transcripts and interaction waits;
- artifact graph and valid revision history;
- story inventory and per-story dispatch records;
- Git baseline, worktree, branch and commits;
- tests, review findings and applied fixes;
- walkthrough and manual observations;
- retrospective verdict;
- resource, cancellation and recovery observations;
- usability issues encountered in the PWA.

## Exit and review

Michael reviews the implementation diff, runs the TTS application, performs the long-document playback checks, inspects tests and evidence, and either accepts or requests rework. Only explicit acceptance permits fast-forward integration into the TTS base branch.

The sprint closes with `docs/bmad-native-epic-validation.md`, separating:

- TTS feature verdict;
- MIC platform verdict;
- BMAD contract findings;
- defects requiring correction;
- explicitly deferred improvements.
