# Sprint 10 – Durable Interactive Workflow Sessions

**Epic:** [BMAD-native MIC PWA](./epic-bmad-native-mic.md)
**Depends on:** Sprint 09 workstream core

## Goal

Allow MIC to host real multi-turn BMAD workflows that wait for human input, resume in context and survive service interruption.

## Product increment

A user can start an interactive BMAD workflow in the browser, read its response, answer questions or select menu options, pause it, resume it and recover it after restarting MIC.

## Work

1. Establish the OpenCode session create/resume contract from Sprint 08 fixtures.
2. Persist ordered user, assistant and tool turns with their raw provider references.
3. Add execution states for queued, resource-waiting, running, waiting-for-input, blocked, cancelled, failed and finished.
4. Distinguish a BMAD menu or question from a terminal response without relying solely on prose heuristics.
5. When structured signaling is unavailable, retain the raw response and require an explicit safe classification path.
6. Add response, menu-selection, pause, resume, cancel and retry APIs with idempotency.
7. Stream session state, new turns and resource changes to the PWA with SSE or an equivalent local event channel.
8. Recover process and session state after MIC restart; never silently repeat a completed user turn.
9. Route blocked outcomes into the same attention model while retaining their originating workflow and artifact context.
10. Keep each BMAD workflow in a separate session and pass cross-workflow context through named artifacts.

## Acceptance criteria

- A real interactive workflow reaches `WAITING_FOR_INPUT`, accepts a browser response and continues in the same session.
- Restarting MIC while waiting preserves the transcript and the next valid action.
- Restarting during execution produces a truthful recoverable, failed or interrupted state.
- Duplicate response submission does not create duplicate turns or workflow progress.
- Cancellation terminates the active process and preserves partial artifacts for inspection.
- A blocked workflow presents its reason and a supported recovery action.
- The browser updates without five-second polling for active session events.

## Exit and review

Michael completes a multi-step scratch BMAD interaction entirely through the PWA, restarts MIC mid-workflow, resumes it, and verifies the transcript and artifacts remain coherent.
