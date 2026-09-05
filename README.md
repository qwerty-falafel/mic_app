# MIC system

This repository implements Morgan's Intelligent Control (MIC) using the fast-track milestones recorded under `sprints/`.

## Current status

Sprint 01 is **accepted as sufficient to proceed with deferred validation**. The local router, OpenCode transport, BMAD configuration and project skills are operational. Successful Build Auto artifacts, a genuine blocked payload and the bmad-loop result contract remain unvalidated; they will be captured while implementing the execution path that uses them. See `docs/phase0-validation.md`.

## Commands

```sh
npm ci
npm run build
npm test
npm run test:coverage

# Discovery only. Expected to exit nonzero because execution is not run.
npm run phase0

# Optional full live validation. Creates a fresh isolated scratch repository.
npm run phase0 -- --live --model llama.cpp/Qwen3.8-27b-q8 --timeout-ms 900000
```

The live validator exits zero only when every automated check passes; its timeout is an operator-supplied execution bound rather than a model SLA. Scratch repositories remain under `.phase0/` for diagnosis; captured commands, telemetry, artifacts, hashes, and resource samples remain under `test/fixtures/phase0/`.
