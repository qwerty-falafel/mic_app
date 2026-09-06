# MIC application

This repository contains the executable Morgan's Intelligent Control (MIC) application: its API, PWA, database schema and migrations, tests, BMAD/OpenCode integration, and local operating scripts.

Product policy, assessments, architecture direction, epics, Sprints, and delivery evidence live in the sibling [`../mic_product_development`](../mic_product_development) repository. The active work is the [Guided Product Delivery UX Epic](../mic_product_development/epics/001-guided-product-delivery-ux.md), currently in [Sprint 03](../mic_product_development/sprints/001-guided-product-delivery-ux/sprint-03-guided-delivery-workspace.md). MIC's canonical vocabulary is [Scrum and Product Terminology](../mic_product_development/policy/scrum-and-product-terminology.md).

The physical machine's hardware and host configuration are documented separately in [`../machine_setup`](../machine_setup). MIC does not own that machine configuration.

## Run MIC locally

Install dependencies once:

```sh
cd /home/michael/projects/mic_app
npm ci
```

The normal development command starts the project-local PostgreSQL server, runs migrations, builds the PWA, and starts MIC:

```sh
cd /home/michael/projects/mic_app
npm run dev
```

MIC stores development data under `.runtime/postgres`. PostgreSQL listens only on `127.0.0.1:54329`, and MIC listens only on `127.0.0.1:3100`.

For separate database and API processes, use two terminals:

```sh
# terminal 1
cd /home/michael/projects/mic_app
npm run db:start

# terminal 2
cd /home/michael/projects/mic_app
npm run web:build
npm run dev:api
```

Open:

- MIC PWA: <http://127.0.0.1:3100/>
- Interactive Swagger API: <http://127.0.0.1:3100/docs/>
- Health: <http://127.0.0.1:3100/health>
- Combined system status: <http://127.0.0.1:3100/system/status>

For frontend development, leave the API running, run `npm run dev:web` in a third terminal, and open <http://127.0.0.1:5173/>. Vite proxies MIC API requests to port 3100.

Real planning and Build Auto require the llama.cpp router at `127.0.0.1:10000`, OpenCode, and a project attached to a clean local Git repository. MIC defaults to `llama.cpp/gpt-oss-120b-F16`; keep `gpt-oss-120b-F16` loaded for normal MIC work. Set `MIC_MODEL` only for an intentional per-process override.

Stop the combined development server with `Ctrl-C`. The next `npm run dev` reuses the same local database.

## Use the BMAD control plane

1. Open **Projects**, create or select a project, and attach an existing clean Git repository by absolute path.
2. Select **Inspect BMAD** to view the installed catalog, version, modules, settings, and output paths.
3. Create work from a brief. MIC recommends a delivery path while allowing an explicit override.
4. Run the recommended installed BMAD operation and follow its durable conversation. A workflow needs an answer only when it says **Waiting for input** or **Blocked**.
5. Refresh the artifact index after a workflow writes files. Review the latest immutable revision, then accept it or request a revision with concrete feedback.
6. For a spec-backed epic, accept `SPEC.md`, create and review the story breakdown, then dispatch eligible stories individually.
7. Review implementation evidence and make integration an explicit final decision.

Requesting an artifact revision records feedback against the exact revision and returns the work to the artifact's owning workflow. It does not approve the document. Starting a new reading or workflow session must not silently reuse stale output from an earlier session.

## Development checks

```sh
npm run build
npm run web:check
npm test
npm run test:integration
```

Phase 0 discovery remains available with `npm run phase0`. A full live validation can be run with:

```sh
npm run phase0 -- --live --model llama.cpp/gpt-oss-120b-F16 --timeout-ms 900000
```

Historical captured fixtures may contain the repository's former `machine_setup` path. Those files are immutable evidence of their original runs and are not current operating instructions.
