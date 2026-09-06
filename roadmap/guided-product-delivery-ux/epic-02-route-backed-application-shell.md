# Epic 02 – Route-backed Application Shell

**Initiative:** [Guided Product Delivery UX](./README.md)
**Depends on:** Epic 01 lifecycle projection and slugs

## Goal

Turn MIC's views into stable places that preserve hierarchy, selection, scroll ownership, and browser behavior.

## Product increment

Products, delivery cases, stages, runs, and artifacts have human-readable URLs and breadcrumbs. Refresh, Back, Forward, bookmarks, and direct links restore the same meaningful view.

## Work

1. Introduce a small client router with routes for Home, Products, Product, delivery overview, stage, run, artifact revision, backlog, settings, and advanced actions.
2. Use slugs in visible URLs while resolving immutable IDs server-side.
3. Build a persistent application shell with global navigation, breadcrumb, product context, and an outlet for the current workspace.
4. Make product and delivery sidebars independently scrollable and collapsible.
5. Define scroll ownership: the browser shell stays fixed while conversations, documents, logs, and history scroll within their panels.
6. Restore selection and relevant scroll position on refresh and browser history navigation.
7. Focus the destination heading or workspace when a route changes.
8. Make narrow layouts use an overlay navigator; selecting an item closes it and reveals the destination immediately.
9. Add not-found, renamed-slug redirect, loading, and unavailable states.
10. Cover route restoration and direct links with browser tests.

## Acceptance criteria

- `/products/tts-application/delivery/stream-long-text/specification` opens the current TTS planning workspace directly.
- Selecting an activity or artifact updates the URL and visible centre workspace without moving content above the viewport.
- Refresh retains the selected run or artifact.
- Browser Back returns through actual visited locations.
- Breadcrumbs show Home / TTS Application / Long-form TTS / Specification.
- At 390 px, the selected destination is visible after one tap and the navigation drawer closes.
- The original Brief cannot make the application page thousands of pixels tall.

## Exit and review

Navigate the seeded TTS case by links, refresh every principal route, and repeat the selection journey at desktop and 390 px.
