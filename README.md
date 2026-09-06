# MIC system

This repository implements Morgan's Intelligent Control (MIC). The active roadmap is the [BMAD-native MIC PWA epic](sprints/epic-bmad-native-mic.md); Sprints 01–07 remain the foundation record.

## Current status

Sprints 01–07 produced the durable kernel, Git worktree isolation, OpenCode transport, resource checks and first playable browser checkpoint. Real use showed that the fixed lifecycle reduces BMAD to one `bmad-spec` run, an empty technical-discovery transition and one whole-intent Build Auto run. That path is superseded and must not be used for implementation work.

The active [BMAD-native MIC PWA epic](sprints/epic-bmad-native-mic.md) begins with Sprint 08. It rebuilds MIC around discovered BMAD skills, durable interactive sessions, native artifacts and adaptive development paths. The existing TTS work remains a paused validation candidate until the final Sprint 14.

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

Real planning and Build Auto require the llama.cpp router at `127.0.0.1:10000`, OpenCode, the configured model, and a project with an attached absolute path to a clean local Git repository. MIC's default model is `llama.cpp/gpt-oss-120b-F16`; keep `gpt-oss-120b-F16` loaded for normal MIC work. Set `MIC_MODEL` only for an intentional per-process override. Planning/execution requests can run for a long time; their run appears in the UI and can be cancelled from the work-item view.

At planning approval, open the latest planning artifact from the work-item view. If it needs changes, enter feedback and select **Request planning revision**. MIC records the review and returns the item to planning; select **Start real planning** to revise the document in the same isolated branch. Review the newly hashed artifact, then repeat the feedback step or approve it. An older revision cannot be approved after a newer one exists.

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
npm run phase0 -- --live --model llama.cpp/gpt-oss-120b-F16 --timeout-ms 900000
```

The live validator exits zero only when every automated check passes; its timeout is an operator-supplied execution bound rather than a model SLA. Scratch repositories remain under `.phase0/` for diagnosis; captured commands, telemetry, artifacts, hashes, and resource samples remain under `test/fixtures/phase0/`.
