# MIC system

This repository implements Morgan's Intelligent Control (MIC). The active roadmap is the [BMAD-native MIC PWA epic](sprints/epic-bmad-native-mic.md); Sprints 01–07 remain the foundation record.

## Current status

Sprints 01–07 produced the durable kernel, Git worktree isolation, OpenCode transport, resource checks and first browser checkpoint. Real use showed that its fixed lifecycle reduced BMAD to one `bmad-spec` run, an empty technical-discovery transition and one whole-intent Build Auto run. That legacy path remains queryable as history and is fail-closed for new implementation work.

Sprints 08–13 of the [BMAD-native MIC PWA epic](sprints/epic-bmad-native-mic.md) add discovered BMAD operations, durable multi-turn sessions, immutable artifact revisions, feedback and review, adaptive workstream paths, one-story delivery and explicit fast-forward integration. Sprint 14 uses the preserved TTS feature as the real platform validation. The observed BMAD transport and artifact behavior is recorded in [the contract observatory](docs/bmad-contract-observatory.md).

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

## Using the BMAD-native PWA

1. Open **Projects**, create or select a project, and attach the absolute path of an existing clean Git repository.
2. Select **Inspect BMAD**. MIC reads the installed catalog and shows its version, modules, effective settings and output paths. Shared BMAD tooling still resolves `{project-root}` to the attached repository.
3. Describe the desired outcome and choose a path:
   - **Direct attended Build** for one bounded change;
   - **Spec-backed epic** for a concise spec and ordered story delivery;
   - **Project-sized planning** for product, UX and architecture work before epics;
   - **Research, review or course correction** for an existing body of work.
4. Open the workstream and choose a concrete installed operation. **Ask BMAD what next** is the `bmad-help` operation. The PWA always shows the skill and action it will invoke.
5. Follow the session transcript. When BMAD asks something, reply in the same session. Running sessions update over SSE and can be paused or cancelled. After a service restart, incomplete execution is marked **Interrupted** and can be resumed from its durable provider session.
6. Select **Refresh index** after a workflow writes files. Review the exact artifact revision in the browser. Accept it or enter feedback; feedback starts a new session for the artifact's owning workflow and keeps the rejected revision immutable.
7. For a spec-backed epic, run Story Breakdown with `bmad-spec`, index the resulting `stories.yaml`, and select **Read stories.yaml**. Dispatch one eligible story with attended Build or Build Auto. MIC never gives Build Auto the whole epic.
8. Use code review, walkthrough and retrospective operations as the story inventory reaches completion. Final integration is a separate explicit API decision and succeeds only when the base repository is clean and the result is a fast-forward.

`bmad-loop` remains hidden from the normal workstream choices: its current observed pilot paused with zero completed stories and required manual rollback. MIC will expose it only after that installed contract passes.

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
