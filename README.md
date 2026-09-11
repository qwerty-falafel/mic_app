# MIC application

This repository contains the executable Morgan's Intelligent Control (MIC) application: its API, PWA, database schema and migrations, tests, BMAD/OpenCode integration, and local operating scripts.

Product policy, assessments, architecture direction, epics, Sprints, and delivery evidence live in the sibling [`../mic_product_development`](../mic_product_development) repository. The current implementation is [Product Portfolio and AI-Guided Delivery](../mic_product_development/epics/002-product-portfolio-and-ai-guided-delivery.md). MIC's canonical vocabulary is [Scrum and Product Terminology](../mic_product_development/policy/scrum-and-product-terminology.md).

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

Real planning and Build Auto require the llama.cpp router at `127.0.0.1:10000`, OpenCode, and a project attached to a clean local Git repository. Start the router in its own terminal before beginning model-backed work:

```sh
cd /home/michael/src/llama.cpp
HIP_LAUNCH_BLOCKING=1 ./build-rocm/bin/llama-server \
  --models-preset /srv/ai/llama-models.ini \
  --models-max 1 \
  --host 127.0.0.1 \
  --port 10000
```

The router loads models on demand. MIC defaults to `llama.cpp/gpt-oss-120b-F16`; keep `gpt-oss-120b-F16` loaded for normal MIC work. Set `MIC_MODEL` only for an intentional per-process override.

Stop the combined development server with `Ctrl-C`. The next `npm run dev` reuses the same local database.

## Run the production service

Build once after each update, then start the managed launcher. It starts the same persistent project-local PostgreSQL database and MIC listener used in development, without rebuilding files at service start:

```sh
cd /home/michael/projects/mic_app
npm ci
npm run production:build
npm run serve
```

Local mode remains the recovery path at <http://127.0.0.1:3100/>. For the protected remote deployment, copy `.env.example` to the host-owned environment location documented in [`../machine_setup/runbooks/secure-remote-mic.md`](../machine_setup/runbooks/secure-remote-mic.md), fill in the Cloudflare Access values, and let the host service load that file. Remote mode refuses to start without an HTTPS public origin, a Cloudflare Access audience, and one exact allowed email address.

The production processes keep PostgreSQL, MIC, the llama.cpp model router, and the Cloudflare tunnel on loopback. The tunnel publishes only MIC. It does not expose ports `54329` or `10000`.

## Use MIC

1. Open **Products** to resume an enduring Product or create one from its name, purpose, and proposed Product Goal. A repository is optional at this stage.
2. Use **Roadmap** to relate the current Product Goal to persistent Features and temporary Epics. It is an outcome hierarchy and does not invent dates.
3. Use **Briefs** to ask GPT-OSS 120B for a reasoned proposal and an explained BMAD planning-depth recommendation. Request revisions or reject it; accepting the exact proposal revision creates proposed Product records but does not approve BMAD planning or start Build.
4. Order and refine Stories, Defects, and Discoveries in **Backlog**. Use **Board** for their independent flow status and **Sprints** for explicit timeboxed selection around one Sprint Goal. Neither action advances a BMAD gate.
5. Attach a Git repository in **Product settings**, then prepare an Epic or bounded PBI from its Product view. MIC checks the repository's installed BMAD catalog and creates the recommended Delivery Case. A spec-backed Epic must produce an accepted `SPEC.md` and an accepted `stories.yaml`; MIC then synchronizes those Stories into the same Product Backlog.
6. Follow the durable BMAD delivery conversation. A workflow needs an answer only when it says **Waiting for input** or **Blocked**. BMAD technical review produces findings and evidence; only your explicit MIC decision can accept an immutable artifact revision.
7. Inspect usable Increments in **Releases**, consequential events in **Activity**, and make final integration an explicit decision.

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
