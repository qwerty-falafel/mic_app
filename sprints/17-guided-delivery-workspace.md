# Sprint 17 – Guided Delivery Workspace

**Epic:** [Guided Product Delivery UX](./epic-guided-product-delivery-ux.md)
**Depends on:** Sprint 16 application shell

## Goal

Make resuming work answer four questions immediately: what outcome is this, where is it, what needs me, and what happens next?

## Product increment

Opening a delivery case lands on its current task. The workspace shows one stage, one reason, one primary action, and state-aware alternatives. BMAD commands are supporting detail rather than the navigation model.

## Work

1. Replace the full-Brief title block with a compact header: classified type, title, current summary, status, stage, repository, and branch.
2. Put the immutable Brief, workspace provenance, and raw intent in expandable context.
3. Render the server-owned stage map with separate visual treatments for complete, current, next, blocked, and unavailable.
4. Build a current-task card containing the attention target, why it matters, the decision or action required, and the resulting transition.
5. Offer one primary recommended action and a short list of other eligible actions.
6. Move raw installed workflow selection into Advanced actions with skill name, purpose, inputs, eligibility, and expected output.
7. Require an explicit override reason when an advanced action departs from the recommendation; preserve it in audit history.
8. Remove actions whose prerequisites cannot yet exist, or show them disabled only when teaching the path adds value.
9. Make Home and Product cards show classified type, stage, attention, progress, and recommended next action rather than only `ACTIVE`.
10. Add server-driven empty, waiting, blocked, interrupted, superseded, and completed workspaces.

## Acceptance criteria

- Opening the TTS card lands on `Specification review`, with the newest valid spec as the primary task.
- Exactly one stage is visually current; Story Breakdown is visibly next.
- The generic workflow dropdown is absent from the primary workspace.
- Advanced actions can start a valid alternative but cannot bypass prerequisites or approvals.
- The full TTS Brief is collapsed by default and remains readable on demand.
- Home distinguishes work that is running, awaiting a decision, blocked, or ready for its next action.
- The recommended action text states what will happen after it is used.

## Exit and review

A user unfamiliar with BMAD explains the TTS case's current state and next action after viewing only Home and the delivery workspace.
