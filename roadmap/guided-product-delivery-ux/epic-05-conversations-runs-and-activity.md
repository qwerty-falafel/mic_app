# Epic 05 – Conversations, Runs, and Activity

**Initiative:** [Guided Product Delivery UX](./README.md)
**Depends on:** Epic 04 artifact decisions

## Goal

Make BMAD interaction feel like a coherent conversation while keeping execution logs, prompts, artifacts, and audit history distinct.

## Product increment

Every workflow run has a stable conversation route with a bounded transcript, pinned state and composer, semantic title, outputs, logs, and recovery actions. Routine history no longer dominates the delivery workspace.

## Work

1. Give runs semantic titles based on purpose and outcome, such as `Spec revision 3 — paragraph boundary feedback`, while retaining the BMAD skill as metadata.
2. Group activity by stage and date; show the newest relevant event first and move the complete audit stream to History.
3. Build a fixed-height conversation workspace with a pinned header, internally scrollable transcript, and pinned composer when input is required.
4. Position new or resumed conversations at the latest relevant turn and provide jump-to-latest behavior.
5. Collapse orchestration prompts, raw provider messages, tool calls, and repeated context behind explicit technical-detail controls.
6. Render human questions, decisions, menus, and terminal summaries as distinct message types.
7. Separate Conversation, Outputs, Logs, and Run details into tabs without losing the selected run.
8. Show queued, resource-waiting, running, paused, waiting, blocked, interrupted, failed, cancelled, and finished states with one valid recovery action.
9. Keep pause and resume checkpoint semantics visible and distinguish them from cancel.
10. Stream active turns and status into the selected route without extending the application page.

## Acceptance criteria

- A long conversation remains within the viewport and does not increase the outer page height.
- The composer stays visible while awaiting input.
- A finished run says what it produced and links directly to its current artifact.
- Ten historical `bmad-spec` runs are distinguishable by purpose without opening each one.
- Raw logs do not appear as ordinary assistant conversation.
- Refreshing or directly opening a run URL restores its selected tab and conversation.
- Pause, refresh, and resume preserve the provider session and explain the checkpoint state.

## Exit and review

Run an interactive fixture through wait, answer, pause, refresh, resume, artifact output, and completion using only the bounded conversation workspace.
