# Phase-0 evidence captures

Each timestamped directory is an immutable validator run. A capture contains exact argv/cwd/exit metadata, stdout and stderr, JSON telemetry, one-second resource samples, before/after artifact inventories with SHA-256 hashes, and copies of files created or changed by the workflow.

- `2026-09-05T15-04-51-698Z-ec90b86b` exposed two harness defects: OpenCode resolved skills from the parent checkout and the combined BMM+GDS config made `planning_artifacts` ambiguous. It is retained as diagnostic evidence and is not an acceptance run.
- `2026-09-05T15-40-21-914Z-131b1d05` used a separate Git root, explicit skill path, and minimal BMM config. The small planning workflow timed out after 900 seconds with only `.memlog.md` written. Dependent scenarios were interrupted while the validator's hard-gate handling was corrected. The current validator skips them after planning failure.

The current report points to the second capture. A future successful run should create a new directory; existing evidence must not be overwritten or promoted to a passing fixture.
