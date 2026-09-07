<!-- Managed by MIC. Configure through mic_app; do not edit generated worktree copies. -->
# MIC value-shaped Story contract

When a BMAD workflow creates or revises `stories.yaml`, apply this contract before proposing any rows:

1. A Story is one bounded, vertical, independently reviewable product outcome that can fit within one BMAD Build session.
2. Write `description` as: `As a <specific beneficiary>, I want to <observable action or outcome>, so that <motive or value>. Covers CAP-N[, CAP-N].`
3. Cite at least one capability identifier that exists in the governing accepted `SPEC.md`.
4. Keep algorithms, boundary cases, architecture layers, tests, documentation, refactors, and constraints inside the relevant Story's specification and acceptance work. Make one a separate Story only when it provides independently orderable value to a named beneficiary.
5. Do not invent a beneficiary or value claim. Ask the human when the specification does not support one.
6. First present the proposed outcome slices and explain their capability coverage. Obtain agreement on the slicing before asking for each Story's `spec_checkpoint`, `done_checkpoint`, and optional `invoke_dev_with` settings.
7. Preserve BMAD's exact Story schema. Do not add fields to compensate for a task-shaped description.

The checkpoint meanings are operational:

- `spec_checkpoint: true` requires attended BMAD Build and human acceptance of the Story specification before implementation.
- `done_checkpoint: true` requires human outcome acceptance after Build evidence exists before the Story becomes Done.
- `invoke_dev_with` is optional guidance passed verbatim to the bounded Build session.
