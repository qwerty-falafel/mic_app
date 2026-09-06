# Phase‑0 Execution Validation Report

Generated: 2026-09-05T15:56:39.031Z
Run: `2026-09-05T15-40-21-914Z-131b1d05`
Model: `llama.cpp/Qwen3.8-27b-q8`
Router: `http://127.0.0.1:10000`

This report is a historical capture of the Qwen-based validation run. The current MIC default is `llama.cpp/gpt-oss-120b-F16`; new validation and execution runs should use GPT-OSS 120B unless `MIC_MODEL` is deliberately overridden.

**Decision: SUFFICIENT TO PROCEED WITH DEFERRED VALIDATION.**
The matrix remains an accurate record of which automated contracts were and were not validated.

The isolated `bmad-spec` run reached the operator-selected 900-second bound after writing the canonical `.memlog.md` but before producing `SPEC.md`. This is an incomplete contract capture, not a 15-minute architectural SLA failure. The later scenario rows in this capture were operator-interrupted while dependency handling was being corrected; their `command.json` files record `error: "Validation interrupted"`. Successful planning and Build Auto artifacts, a genuine blocked payload and the bmad-loop result contract remain deferred until the execution milestone that uses them.

Observed versions: BMAD installation/BMM `6.12.0`, OpenCode `1.18.27`, bmad-loop `0.11.1`, llama.cpp revision `7798007a29a90e3053e799394da48cf53a2f8e0f`.

## Decision matrix

| Check | Result | Finding | Evidence |
|---|---|---|---|
| opencode-version | pass | 1.18.27 | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/opencode-version/command.json) |
| opencode-agents | pass | build (primary), compaction (primary), explore (subagent), general (subagent), plan (primary), summary (primary), title (primary) | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/opencode-agents/command.json) |
| opencode-cli | pass |  | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/opencode-cli/command.json) |
| bmad-loop-version | pass | bmad-loop 0.11.1 | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/bmad-loop-version/command.json) |
| bmad-loop-cli | pass | usage: bmad-loop run [-h] [--project PROJECT] [--spec FOLDER] [--epic EPIC] | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/bmad-loop-cli/command.json) |
| uv | pass | uv 0.12.9 (x86_64-unknown-linux-gnu) | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/uv/command.json) |
| tmux | pass | tmux 3.6 | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/tmux/command.json) |
| installed:_bmad/config.toml | pass | Present | — |
| installed:_bmad/_config/manifest.yaml | pass | Present | — |
| installed:_bmad/scripts/render_skill.py | pass | Present | — |
| installed:.agents/skills/bmad-build-auto/SKILL.md | pass | Present | — |
| installed:.agents/skills/bmad-build-auto/workflow.md | pass | Present | — |
| installed:.agents/skills/bmad-spec/SKILL.md | pass | Present | — |
| router-health | pass | 200, 29.2 ms | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/router-health.json) |
| model-advertised | pass | Qwen3.8-27b-q8 | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/router-models.json) |
| router-idle | pass | Loaded model slots are idle | — |
| model-inference | pass | 200, 6228 ms (includes cold load); timings={"cache_n":0,"prompt_n":58,"prompt_ms":578.151,"prompt_per_token_ms":9.968120689655171,"prompt_per_second":100.31981264410165,"predicted_n":8,"predicted_ms":923.993,"predicted_per_token_ms":131.999,"predicted_per_second":7.575814968295213} | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/model-inference.json) |
| model-inference-profile | pass | Complete request 6228 ms; prompt 100.32 tokens/s; generation 7.58 tokens/s. Full-request duration is recorded separately from router health and is not compared with the ambiguous 200 ms criterion. | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/model-inference.json) |
| planning | fail | SPEC paths: none; exit null | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/planning/inventory.json) |
| supervised-planning | fail | No ready-for-dev artifact | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/supervised-plan/observed-contracts.json) |
| supervised-build | not-run | Planning did not reach ready-for-dev | — |
| unattended-build | fail | Requires durable done status, independent assertions and project tests | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/unattended-build/observed-contracts.json) |
| subagents | fail | Require completed task tool calls, not just agent listing | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/unattended-build/telemetry.json) |
| blocked | fail | task disabled; require persisted blocked / no subagents payload | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/blocked/observed-contracts.json) |
| blocked-recovery | not-run | No blocked artifact to recover | — |
| loop-preflight | pass | Preflight, distinct from epic execution | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/loop-preflight/stdout.log) |
| bmad-loop | fail | 0/2 done; 0 result.json files; exit 0 | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/bmad-loop/inventory.json) |
| loop-resource-profile | pass | {"samples":9,"minAvailableMiB":69193.2109375,"peakRssMiB":3658.82421875,"peakGpuResidentMiB":42871.19921875,"peakCombinedFraction":0.37186225550192376,"gpuMeasured":true,"peakSystemCpuPercent":10.229055538123632,"swapInDelta":0,"swapOutDelta":0,"oomKillDelta":0} | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/bmad-loop/command.json) |
| resource-profile | fail | Every scenario: >200 MiB available, <75% unified-memory bound, GPU measured, zero swap/OOM deltas | [capture](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/unattended-build/resources.jsonl) |

## Reproduce

```sh
npm ci
npm run build
npm test
npm run phase0 -- --live --model llama.cpp/gpt-oss-120b-F16 --timeout-ms 900000
```

Omit `--live` for discovery only; discovery deliberately exits nonzero because execution is unvalidated.
Raw commands, telemetry, resource samples and inventories: [this run](../test/fixtures/phase0/2026-09-05T15-40-21-914Z-131b1d05/validation.json).
Scratch repositories: `/home/michael/projects/machine_setup/.phase0/2026-09-05T15-40-21-914Z-131b1d05`. Each validation uses new directories and preserves prior captures.

## Contract corrections

- BMAD is installed as skills invoked through OpenCode, not a `bmad plan` / `bmad build-auto` CLI.
- Inspect agents with `opencode agent list`. Build Auto is a skill, not an agent named build-auto. Completed task tool events prove subagent execution.
- Installed Build Auto writes YAML frontmatter status and an Auto Run Result section in Markdown. Capture actual paths, including hidden .memlog.md, rather than manufacturing result.json.
- bmad-loop uses `run --project <root> --spec <folder> --max-stories 2`. Its validate command is only preflight.
- The combined BMM+GDS central config repeats the shorthand `planning_artifacts` key, which Build Auto rendering rejects as ambiguous. The corrected isolated BMM pilot records and uses a minimal central config.
- Newer sprint/epic lifecycle takes precedence over the older implementation plan: multiple repositories per project, both approvals before implementation.

## Resource interpretation

One-second samples plus command boundaries record RSS and AMD DRM resident GTT/VRAM separately. Their sum is a conservative bound because mappings can overlap. CPU is system utilisation; swap and OOM use counter deltas. Missing GPU measurements fail validation.
Health round-trip, cold inference request, time to first token, generation throughput and total workflow duration are distinct metrics. This non-streaming capture contains complete-request and llama.cpp token timings but does not provide a separate time-to-first-token measurement.

## Sources

- Installed manifest and Build Auto workflow are snapshotted under installed/ in this capture.
- [OpenCode CLI](https://opencode.ai/docs/cli/)
- [bmad-loop](https://github.com/bmad-code-org/bmad-loop)

## Sprint handoff

Sprint 01 is accepted as sufficient to proceed under the fast-track decision dated 2026-09-05. Unvalidated checks remain visible and are not represented as passing. Their real contracts will be captured opportunistically during the combined execution and lifecycle milestone.
