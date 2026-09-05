# MIC system

This repository implements Morgan's Intelligent Control (MIC) using the fast-track milestones recorded under `sprints/`.

## Current status

Sprint 01 is **accepted as sufficient to proceed with deferred validation**. Sprint 02's durable kernel is implemented: domain state, audit events and transactional outbox events persist in PostgreSQL, while pg-boss dispatch and consumer-side deduplication provide restart-safe asynchronous work. Successful Build Auto artifacts, a genuine blocked payload and the bmad-loop result contract remain deferred to the combined execution/lifecycle milestone. See `docs/phase0-validation.md` and `docs/kernel-architecture.md`.

## Playable local checkpoint

Install dependencies once:

```sh
cd /home/michael/projects/machine_setup
npm ci
```

The normal development command starts the persistent project-local PostgreSQL server, runs migrations, builds the PWA and starts MIC:

```sh
cd /home/michael/projects/machine_setup
npm run dev
```

It stores data under `.runtime/postgres`; PostgreSQL listens only on `127.0.0.1:54329` and MIC listens only on `127.0.0.1:3100`.

For separate database and API processes, use two terminals:

```sh
# terminal 1
cd /home/michael/projects/machine_setup
npm run db:start

# terminal 2
cd /home/michael/projects/machine_setup
npm run web:build
npm run dev:api
```

Open:

- MIC PWA: <http://127.0.0.1:3100/>
- Interactive Swagger API: <http://127.0.0.1:3100/docs/>
- Health: <http://127.0.0.1:3100/health>
- Combined system status: <http://127.0.0.1:3100/system/status>

For frontend development, leave the API running and use `npm run dev:web` in terminal 3, then open <http://127.0.0.1:5173/>. Vite proxies MIC API requests to port 3100.

Real planning and Build Auto require the llama.cpp router at `127.0.0.1:10000`, OpenCode, the configured model, and a project with an attached absolute path to a clean local Git repository. Planning/execution requests can run for a long time; their run appears in the UI and can be cancelled from the work-item view.

Stop the combined development server with one `Ctrl-C`. The next `npm run dev` reuses the same data.

## Development checks

```sh
npm ci
npm run build
npm test
npm run test:coverage
npm run test:integration

# Discovery only. Expected to exit nonzero because execution is not run.
npm run phase0

# Optional full live validation. Creates a fresh isolated scratch repository.
npm run phase0 -- --live --model llama.cpp/Qwen3.8-27b-q8 --timeout-ms 900000
```

The live validator exits zero only when every automated check passes; its timeout is an operator-supplied execution bound rather than a model SLA. Scratch repositories remain under `.phase0/` for diagnosis; captured commands, telemetry, artifacts, hashes, and resource samples remain under `test/fixtures/phase0/`.
