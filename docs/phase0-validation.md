# Phase‑0 Execution Validation Report

Generated: 2026-09-06T14:15:12.108Z
Run: `2026-09-06T14-07-21-588Z-7b48517f`
Model: `llama.cpp/gpt-oss-120b-F16`
Router: `http://127.0.0.1:10000`

**Automated result: INCOMPLETE — see failed and unrun checks.**
Sprint 01 is accepted as sufficient to proceed with deferred validation. This script reports evidence and never records product approval.

## Decision matrix

| Check | Result | Finding | Evidence |
|---|---|---|---|
| opencode-version | pass | 1.18.27 | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/opencode-version/command.json) |
| opencode-agents | pass | build (primary), compaction (primary), explore (subagent), general (subagent), plan (primary), summary (primary), title (primary) | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/opencode-agents/command.json) |
| opencode-cli | pass |  | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/opencode-cli/command.json) |
| bmad-loop-version | pass | bmad-loop 0.11.1 | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/bmad-loop-version/command.json) |
| bmad-loop-cli | pass | usage: bmad-loop run [-h] [--project PROJECT] [--spec FOLDER] [--epic EPIC] | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/bmad-loop-cli/command.json) |
| uv | pass | uv 0.12.9 (x86_64-unknown-linux-gnu) | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/uv/command.json) |
| tmux | pass | tmux 3.6 | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/tmux/command.json) |
| installed:_bmad/config.toml | pass | Present | — |
| installed:_bmad/_config/manifest.yaml | pass | Present | — |
| installed:_bmad/scripts/render_skill.py | pass | Present | — |
| installed:.agents/skills/bmad-build-auto/SKILL.md | pass | Present | — |
| installed:.agents/skills/bmad-build-auto/workflow.md | pass | Present | — |
| installed:.agents/skills/bmad-spec/SKILL.md | pass | Present | — |
| bmad-version | pass | installation 6.12.0; modules {"core":"6.12.0","bmm":"6.12.0","cis":"v0.3.2","bmad-loop":"v0.11.1","tea":"v1.24.0","gds":"v0.7.2","bmb":"v2.2.2"} | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/installed/_bmad/_config/manifest.yaml) |
| llama-process | pass | 2 llama-server process(es); full command lines captured | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/llama-processes/stdout.log) |
| llama-revision | pass | 7798007a29a90e3053e799394da48cf53a2f8e0f | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/llama-revision/command.json) |
| router-health | pass | 200, 30.3 ms | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/router-health.json) |
| model-advertised | pass | gpt-oss-120b-F16 | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/router-models.json) |
| router-idle | pass | Loaded model slots are idle | — |
| model-inference | pass | 200, 420 ms (includes cold load); timings={"cache_n":68,"prompt_n":5,"prompt_ms":98.077,"prompt_per_token_ms":19.6154,"prompt_per_second":50.98035217227281,"predicted_n":8,"predicted_ms":217.58,"predicted_per_token_ms":31.082857142857144,"predicted_per_second":32.17207463921316} | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/model-inference.json) |
| model-inference-profile | pass | complete request 420 ms; prompt 50.98035217227281 tokens/s; generation 32.17207463921316 tokens/s; time to first token unavailable from non-streaming response | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/model-inference.json) |
| planning | pass | SPEC paths: _bmad-output/specs/spec-arithmetic-pilot/SPEC.md; exit 0; timedOut false; duration 183.7 s | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/planning/inventory.json) |
| supervised-planning | pass | _bmad-output/implementation-artifacts/spec-export-add.md | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/supervised-plan/observed-contracts.json) |
| supervised-build | fail | Requires durable done status, independent assertions and project tests | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/supervised-build/observed-contracts.json) |
| unattended-build | fail | Requires durable done status, independent assertions and project tests | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/unattended-build/observed-contracts.json) |
| subagents | fail | Require completed task tool calls, not just agent listing | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/unattended-build/telemetry.json) |
| blocked | fail | task disabled; require persisted blocked / no subagents payload | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/blocked/observed-contracts.json) |
| blocked-recovery | not-run | No blocked artifact to recover | — |
| loop-preflight | not-run | Skipped by --skip-loop | — |
| bmad-loop | not-run | Skipped by --skip-loop | — |
| resource-profile | fail | Every direct scenario remains within the recorded resource policy | [capture](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/unattended-build/resources.jsonl) |

## Reproduce

```sh
npm ci
npm run build
npm test
npm run phase0 -- --live --model llama.cpp/gpt-oss-120b-F16 --timeout-ms 900000
```

Omit `--live` for discovery only; discovery deliberately exits nonzero because execution is unvalidated.
Raw commands, telemetry, resource samples and inventories: [this run](../test/fixtures/phase0/2026-09-06T14-07-21-588Z-7b48517f/validation.json).
Scratch repositories: `/home/michael/projects/machine_setup/.phase0/2026-09-06T14-07-21-588Z-7b48517f`. Each validation uses new directories and preserves prior captures.

## Contract corrections

- BMAD is installed as skills invoked through OpenCode, not a `bmad plan` / `bmad build-auto` CLI.
- Inspect agents with `opencode agent list`. Build Auto is a skill, not an agent named build-auto. Completed task tool events prove subagent execution.
- Installed Build Auto writes YAML frontmatter status and an Auto Run Result section in Markdown. Capture actual paths, including hidden .memlog.md, rather than manufacturing result.json.
- bmad-loop uses `run --project <root> --spec <folder> --max-stories 2`. Its validate command is only preflight.
- The combined BMM+GDS central config repeats the shorthand `planning_artifacts` key, which Build Auto rendering rejects as ambiguous. The isolated BMM pilot records and uses a minimal central config.
- Newer sprint/epic lifecycle takes precedence over the older implementation plan: multiple repositories per project, both approvals before implementation.

## Resource interpretation

One-second samples plus command boundaries record RSS and AMD DRM resident GTT/VRAM separately. Their sum is a conservative bound because mappings can overlap. CPU is system utilisation; swap and OOM use counter deltas. Missing GPU measurements fail validation.
Health round-trip, cold inference request, time to first token, generation throughput and total workflow duration are distinct metrics. A non-streaming response may not expose time to first token.

## Sources

- Installed manifest and Build Auto workflow are snapshotted under installed/ in this capture.
- [OpenCode CLI](https://opencode.ai/docs/cli/)
- [bmad-loop](https://github.com/bmad-code-org/bmad-loop)

## Sprint handoff

Sprint 01 is accepted as sufficient to proceed with deferred validation. Failed and unrun checks remain open and will be captured while implementing the execution paths that depend on them.
