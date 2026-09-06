# Sprint 21 – Responsive Recovery and Journey Validation

**Epic:** [Guided Product Delivery UX](./epic-guided-product-delivery-ux.md)
**Depends on:** Sprint 20 backlog and delivery surfaces

## Goal

Remove the remaining dead ends and prove the complete guided experience at desktop and narrow widths under success, error, interruption, and correction conditions.

## Product increment

MIC prevents predictable invalid actions, reports local actionable failures, remains navigable on a narrow browser, and has browser-level journey evidence for every principal state.

## Work

1. Replace global raw exception banners with local problem statements, recovery actions, and a technical-details disclosure.
2. Disable duplicate submissions, preserve entered feedback on recoverable failures, and announce asynchronous state changes accessibly.
3. Handle stale action tokens, changed Git state, model unavailability, invalid artifacts, missing prerequisites, and concurrent session conflicts.
4. Audit keyboard order, focus placement, landmarks, labels, contrast, reduced motion, and screen-reader state announcements.
5. Validate fixed shell, drawers, review, chat, tables, and decision controls at 390 px, tablet, and desktop widths.
6. Add browser tests for Home → Product → current delivery task; artifact feedback and return; acceptance and next action; breakdown; story dispatch; wait/answer; pause/refresh/resume; and integration refusal.
7. Add visual regression fixtures for long Briefs, many revisions, long conversations, invalid artifacts, blocked runs, and large story inventories.
8. Instrument local UX evidence: route visited, recommended action shown, override used, error category, decision latency, and abandoned action, without external telemetry.
9. Run a clean first-use test where the participant has no BMAD command knowledge.
10. Correct every critical or journey-blocking issue found before the TTS acceptance sprint.

## Acceptance criteria

- No seeded journey exposes a deterministically invalid primary action.
- Errors appear next to the triggering action and explain a recovery path.
- Selecting navigation at 390 px immediately reveals the destination.
- Long Briefs, documents, histories, and chats remain within owned scroll regions.
- Keyboard and screen-reader users can reach and understand the current decision and primary action.
- Back, Forward, refresh, and direct URLs pass across all principal routes.
- A no-BMAD-knowledge participant identifies the current stage, required decision, and next result without assistance.

## Exit and review

Michael reviews the browser-test recording and manually completes the seeded epic journey at desktop and narrow width. Any critical confusion returns to the responsible earlier sprint rather than being documented as acceptable friction.
