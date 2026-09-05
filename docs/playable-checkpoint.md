# Playable Checkpoint

The MIC service now serves both the control PWA and an interactive Swagger interface. The PWA polls every five seconds while work is active and also refreshes immediately after each user command.

| Capability | HTTP interface | PWA |
|---|---|---|
| Health and combined system state | `GET /health`, `GET /system/status` | Dashboard |
| Projects and repositories | collection/item GETs and creation POSTs | Create, attach and list |
| Work items and lifecycle | `GET /work-items`, `GET /work-items/:id/detail` | Work list, detail and timeline |
| Planning and implementation | lifecycle POST routes under `/work-items/:id/` | State-aware primary action |
| Approvals | `GET /approvals`, planning/implementation approval POSTs | Revision-specific approval buttons/history |
| Questions | `GET /questions`, `POST /questions/:id/answer` | Open-question inbox |
| Runs and cancellation | run GETs, `GET /runs/:id/logs`, `POST /runs/:id/cancel` | Status, adapter state/logs and cancel |
| Artifacts and evidence | artifact content, evidence and gate routes | Artifact links and evidence references |
| Queue and resources | `GET /scheduler`, `GET /resources` | Dashboard metrics |
| Interactive API | `/docs/` | Header link |

The first real planning run uses the attached repository's configured base branch, creates an isolated `mic/<work-item>/<run>` worktree, and invokes the local model through OpenCode and `bmad-spec`. Implementation reuses the approved planning worktree and invokes `bmad-build-auto`. Final approval requires a fast-forward and then cleans up the worktree.

This checkpoint intentionally has local single-user trust. Bind addresses remain loopback-only by default.
