# MIC Implementation Plan

**Status:** Implementation-grade — ready for Michael's review/approval (REVISED: BMAD adoption)
**Created:** 2026-09-02
**Updated:** 2026-09-06 (GPT-OSS 120B F16 selected as the normal default model)
**Scope:** Build the MIC control plane, queue/scheduler, harness runner, and supporting infrastructure on `themachine`. MIC no longer implements the software-development protocol itself; it drives **BMAD Method** (planning / spec / build / review / retro) and **bmad-loop** (unattended epics) through the **OpenCode** coding harness, on local **llama.cpp** models.

**What changed vs. v1 (this revision).** The original plan had MIC run a custom
LangGraph "lifecycle engine" (a graph per run, checkpoint/resume in Postgres,
`interrupt()` at human-approval states). After evaluating BMAD Method, the
direction changed: **MIC adopts BMAD as the development protocol and keeps only
the control plane it uniquely owns.** LangGraph is demoted from core to
optional (non-software orchestration, only if ever needed). The consequence
analysis, responsibility split, risks, and the pilot gate are in §3.

## 1. What This Document Is

This is the implementation plan for **MIC (Morgan's Intelligent Control)** —
the autonomous AI system Michael is building on the machine `themachine`. It is
the operating system of a software development company where Michael is the
human founder/CEO and AI agents are the workforce.

The plan has two layers:

- **The durable parts** (what does *not* change when the architecture changes):
  the current-state audit (§2), the domain model & data schema (§5), and the
  artifact-store + provenance model (§7). These carry over from v1 with
  BMAD-aware updates.
- **The revised parts** (what the BMAD pivot changes): the architecture &
  responsibility split (§3), technical decisions (§4), and the lifecycle (§6),
  plus the implementation sections (§8–§20), now built around driving BMAD +
  bmad-loop rather than a custom LangGraph graph.

The plan is implementation-grade: every phase names the exact deliverable, the
owner, and how it is verified. The one deliberate exception is **Phase 0 (the
BMAD pilot, §3.7 / §18)**, which is a *spike* — its deliverable is a written
assessment of whether the local model (GPT-OSS 120B F16) can run BMAD workflows
reliably under OpenCode, not production code.

## 2. Current State Audit

What I found on `themachine` as of 2026-09-02:

| Component | Status | Notes |
|-----------|--------|-------|
| OS | Ubuntu 26.04.1 LTS | Kernel 6.17, all standard repos available |
| CPU/GPU | AMD Strix Halo APU (Radeon 8050S/8060S) | Unified memory architecture, 122GB total RAM |
| Disk | 3.6TB, 3.2TB free | NVMe, plenty of space for models |
| Python | 3.14.4 + `uv` (at `~/.local/bin/uv`) | Ready to go |
| C/C++ toolchain | cmake 4.2.3, gcc/g++ 15, build-essential | Ready |
| Git | 2.53.0 | Ready |
| ROCm | Installed, `rocm-smi` functional | GPU visible as device 0x1586 |
| llama.cpp | Source at `~/src/llama.cpp`, **built** with HIP | `build-rocm/bin/llama-server` works; OpenAI-compatible HTTP; flags include `--host/--port/--alias/--parallel/--jinja/--no-webui/--n-cpu-moe/--api-key/--tools` |
| Models | **GPT-OSS 120B F16 installed** | `/srv/models/gpt-oss-120b/gpt-oss-120b-F16.gguf`; this is MIC's approved default |
| Node.js | **Installed** — Node 22.22.1 (`/usr/bin/node`) | Meets pg-boss's `>=22.12.0` and BMAD's Node 20.12+ install requirement; no nvm needed |
| PostgreSQL | **Not installed** | No server, no client |
| Docker | **Not installed** | Not needed for this architecture |
| Existing app | `parliament_people_app/` (Next.js 15, TypeScript, Supabase) | Has its own node/npm wrappers |
| Product dev repo | `parliament_people_product_development/` (markdown, git) | Epics, sprints, assessments |
| `machine_setup/` | Empty directory | This document's home |

### Key implications

- **Unified memory (APU):** The Strix Halo shares system RAM with the GPU.
  llama.cpp with HIP can allocate model weights from the 122GB pool. A 27B Q8
  model (~17GB) fits comfortably. The "1GB VRAM" reported by `rocm-smi` is
  just the dedicated framebuffer; compute uses the unified pool.
- **Node.js and Python are present:** Node 22.22.1 satisfies pg-boss and BMAD's
  install requirement; Python 3.14.4 + `uv` satisfy BMAD's customization resolver
  and bmad-loop (Python 3.11–3.14). There is no Node/Python install step.
- **PostgreSQL is the remaining infra gap.** I install it in Phase 1 (after the
  Phase 0 BMAD pilot, which needs only the already-present model plane + OpenCode).
- **The default model is GPT-OSS 120B F16.** It is installed and advertised by
  the llama.cpp model router as `gpt-oss-120b-F16`. Qwen is not the normal MIC
  default.
- **llama.cpp is ready:** The binary, model preset, and single-slot model router
  are present.

## 3. Architecture (Revised): MIC Control Plane + BMAD Development Protocol

### 3.1 The stack

MIC is a **control plane**. It owns scheduling, state, approvals, permissions,
model/GPU routing, the UI, and cross-project orchestration. It does *not*
implement the software-development method — that is delegated:

```
+---------------------------------------------------------------------+
|  MIC CONTROL PLANE  (TypeScript, the thing we build)                |
|  - PWA + voice (user interfaces)                                    |
|  - Control API (Fastify): projects, work items, approvals, runs     |
|  - Postgres: durable state machine + audit (mic_core schema)        |
|  - pg-boss: job queue, priorities, retries, model/GPU scheduling    |
|  - MODEL ROUTER: picks model + backend by work item type            |
|  - HARNESS RUNNER: spawns OpenCode / bmad-loop in a worktree        |
|  - BMAD ADAPTER: installs/configures BMAD, indexes BMAD artifacts   |
+---------------------------------------------------------------------+
        | dispatch (story id / spec path / intent)         | status / artifacts
        v                                                  v
+---------------------------------+        +------------------------------+
| EXECUTION PLANE (adopted)       |        | PROTOCOL PLANE (adopted)     |
|  OpenCode (coding harness)      |  uses  |  BMAD Method (bmad-method)   |
|  - drives BMAD skills           |<-------|  - plan/spec/build/review    |
|  - calls local models via       |        |  - artifacts + spec status   |
|    llama.cpp (OpenAI-compat)    |        |  - bmad-loop (unattended)    |
+---------------------------------+        +------------------------------+
        |
        v
+------------------------------+
| MODEL PLANE                  |
|  llama.cpp (llama-server)    |
|  GPT-OSS 120B F16 (default)  |
|  Qwen3-VL:32B (vision, opt.) |
+------------------------------+
```

### 3.2 The decision

**Adopt BMAD Method** (`bmad-method` npm module) as the development protocol
that runs *inside* the OpenCode harness; **adopt bmad-loop** (pinned tag) for
unattended, approved epics; **evaluate TEA** later for gates/evidence; **skip
the Creative Intelligence Suite** initially.

Why BMAD:
- **Battle-tested, not homegrown.** It already has the full method — planning
  (PRD/UX/architecture), spec-to-stories, build, review, retrospective, and
  right-sizing guidance — plus the exact failure modes we'd otherwise
  hand-code (context blowup, unattended-loop stalls, local-model unreliability).
- **It is designed for an orchestrator.** `bmad-build-auto` is explicitly meant
  for an external caller and returns terminal status via `result.json` +
  artifact/spec-status. MIC fits that caller role exactly.
- **It runs in our harness on local models.** OpenCode can drive BMAD's
  agent/skill prompts and point at our llama.cpp endpoint. The pilot (§3.7)
  proves this before we build on it.
- **Customizable without forking.** We configure it via `_bmad/custom` TOML
  overrides (persona, principles, persistent facts, artifact locations) — no
  upstream edits.

### 3.3 Responsibility split: what BMAD does vs. what MIC does

| Capability | Who owns it | Note |
|------------|-------------|------|
| Product strategy / PRD / UX / architecture | **BMAD** | `bmad-prd`, `bmad-ux`, `bmad-architecture` |
| Spec → stories decomposition | **BMAD** | `bmad-create-epics-and-stories` → `stories.yaml` |
| One-unit build (implement + test + review) | **BMAD** | `bmad-build-auto` (fresh context, one story) |
| Unattended multi-story epic execution | **bmad-loop** | ordered scheduler + worktrees + opencode driver |
| Retro / evidence verdict (accepted / rejected / open items) | **BMAD** | `bmad-retrospective` (headless) |
| **Cross-project backlog, sequencing, dependencies** | **MIC** | BMAD is single-project; MIC is the layer above |
| **Approvals & human-in-the-loop (Michael's sign-off)** | **MIC** | Postgres state machine; MIC decides when a unit may run |
| **Autonomy policy (unattended vs. must-ask)** | **MIC** | maps to BMAD human vs unattended mode |
| **Model / GPU scheduling (load Q8 vs 32B, swap, batch)** | **MIC** | llama.cpp is single-slot by default; MIC routes |
| **Queue, retries, dead-letter, prioritization** | **MIC** | pg-boss; BMAD has no queue |
| **Multi-agent / multi-project orchestration** | **MIC** | BMAD subagents are *within* a unit, not cross-project |
| **UI, voice, permissions, notifications** | **MIC** | BMAD has none of this |
| **Durable state + audit across days** | **MIC** | Postgres; BMAD artifacts are files, not a DB |

The rule: **MIC owns everything BMAD does not, and delegates everything BMAD
does.** MIC never re-implements planning / spec / build / review.

### 3.4 The key simplification: durability without LangGraph

In v1, "waiting for Michael" meant a LangGraph graph paused at `interrupt()`
with a checkpoint in Postgres, resumed later with `Command(resume=…)`. That
machinery is **no longer needed**, because:

- The **lifecycle** (INTAKE → … → AWAITING_* → … → DONE) is a **state machine
  in Postgres** on `work_items`/`stories`, advanced by MIC commands and pg-boss
  jobs. "Awaiting approval" is just a row value — **no worker is running**, so
  waiting costs nothing and survives restarts (state is in Postgres, pending
  jobs are in pg-boss, which is also Postgres).
- "Doing the work" is a **fresh OpenCode session** running a BMAD skill. It
  runs to a terminal status and writes **durable artifacts to the repo**.
- **Resumption is handled by BMAD, not LangGraph:** `bmad-build-auto` resumes
  from the spec status (`draft / ready-for-dev / in-progress / in-review / done
  / blocked`). After an approval, MIC spawns a fresh session on the approved
  story; that session reads the existing spec/artifacts and continues.

This is actually *more* robust than checkpoint/resume here: it matches BMAD's
own "fresh context per session" model (fixes the 65K-context problem), it's
restart-resilient, and it decouples waiting (free) from doing (a session).

**What we give up:** LangGraph's ability to resume a *partially-completed
multi-node LLM graph* mid-way. If a future **non-software** workflow genuinely
needs durable multi-step LLM graphs (research fan-out/fan-in, OSINT-style
correlation), we reintroduce LangGraph **for that workflow only**, driven by the
same harness-runner pattern. It is not foundational.

### 3.5 Consequences: what MIC no longer builds / still builds

**MIC no longer builds (was in v1, now delegated to BMAD):**
- [ ] Custom planning prompts / PRD / architecture generation
- [ ] Custom spec→stories decomposition
- [ ] Custom "implement + write tests" agent logic
- [ ] Custom code-review agent logic
- [ ] Custom retrospective/verdict logic
- [ ] LangGraph graph definitions + checkpointing for the lifecycle
- [ ] A homegrown context-management strategy for long builds

**MIC still builds (unchanged, or new):**
- [x] Control plane: PWA, voice, Control API (Fastify), auth
- [x] Postgres schema + state machine + audit
- [x] pg-boss queue, priorities, retries/DLQ, scheduler
- [x] Model plane: llama.cpp config, router, model/GPU scheduling
- [x] **Harness Runner** — spawn OpenCode/bmad-loop in a worktree, feed the BMAD
      command + handoff envelope, watch `result.json`/spec status, map terminal
      status → state transition, route `blocked` to Michael (§12)
- [x] **BMAD Adapter & Indexer** — install BMAD per project, apply
      `_bmad/custom` config, index BMAD artifacts into Postgres (§13)
- [x] Gates & evidence: deterministic commands + AI review, then TEA (optional)
- [x] n8n edges (triggers → MIC; MIC → n8n webhooks)

Net effect: **less code in the "smart" parts, more code in the control plane.**
The novel work concentrates in §12 (harness runner) and §13 (BMAD adapter) —
exactly the seam between MIC and the adopted protocol.

### 3.6 Risks & open questions (the honest part)

1. **Local-model reliability (HIGHEST).** All of this assumes GPT-OSS 120B F16
   can follow BMAD's prompts (spec, build, review) well enough. **This is why Phase 0 is a hard gate** — we
   test the real model under real BMAD skills before building the control plane
   on the assumption.
2. **bmad-loop is pre-1.0.** It is beta and moving fast. We **pin a known
   tag/version** (not `latest`) and treat it as replaceable. If it breaks or
   misbehaves on a local model, MIC falls back to driving `bmad-build-auto`
   directly (coarse → fine) without losing the cross-project layer.
3. **`blocked: no subagents` is a routing signal, not failure.** BMAD build can
   report `blocked` when subagents are unavailable (a local-harness
   compatibility concern). MIC must treat this as "route to Michael / fall back
   to single-agent build," not "retry and die."
4. **Two sources of truth.** BMAD keeps state in files (spec frontmatter,
   `stories.yaml`, `_bmad/`); MIC keeps state in Postgres. The BMAD Adapter
   (§13) is the reconciliation point. Rule: **the repo (Git) is the source of
   truth for *artifacts*; Postgres is the source of truth for *orchestration
   state*.** On drift, re-index wins.
5. **Non-software work has no BMAD equivalent.** Research, OSINT-style
   correlation, and novel fan-out/fan-in workflows are *not* covered by BMAD.
   Those are the (deferred) case for a custom LangGraph/agent workflow driven by
   the same harness-runner pattern — out of scope for the pilot.
6. **Model is single-slot by default.** llama.cpp serves one model; switching
   between the default and an optional specialist model costs a reload. MIC's model scheduler (§11) must batch same-model
   work to amortize reloads and never leave a story stuck waiting for a model
   swap mid-run.

### 3.7 Phase 0: the BMAD pilot (hard gate)

Before writing control-plane code, we run a manual, end-to-end pilot. It is a
spike — the deliverable is a written assessment, not production code.

Steps (all on the already-present stack: llama.cpp + models + OpenCode):
1. **Load GPT-OSS 120B F16** through the model router (and record startup time).
2. **`npx bmad-method install`** into a scratch copy of `parliament_people_product_development` (or a
   throwaway repo). Apply a minimal `_bmad/custom` config (persona/principles).
3. **Manual BMAD Build** with OpenCode + GPT-OSS 120B F16: run `bmad-spec` on a small
   real feature, then `bmad-build-auto` on the first story. Observe: does the
   model follow the method? Does it produce a compiling change + tests? How
   long? How many retries?
4. **Unattended run:** `bmad-build-auto` on a second story, no hand-holding.
   Record the terminal status + `result.json` + git diff.
5. **bmad-loop on a small epic** (2–3 stories, ordered). Confirm worktree
   isolation + opencode driver + ordered execution.
6. **`bmad-retrospective`** (headless) on the results. Note the verdict.

**Exit criteria (all must hold to proceed to Phase 1+):**
- The local model completes `bmad-spec` → `bmad-build-auto` on at least one
  real story to a **compiling, test-passing** result with at most limited
  retries.
- Terminal status is reliably emitted (`result.json` + spec status) so MIC can
  monitor it — not assumed.
- `blocked` semantics are understood and reproducible (what triggers it, how
  single-agent fallback behaves).
- A model-timing profile is captured (spec vs build vs review) to
  drive the model router (§11).
- **If the local model cannot do this reliably, we stop and decide:** a bigger
  local model, a different local model, or a hybrid (local for build, cloud for
  review). The plan does not proceed on the assumption otherwise.

### 3.8 The MIC state machine (Postgres-enforced)

Unchanged from v1 — the lifecycle states are the same; they are now enforced by
the Postgres state machine + pg-boss (not a LangGraph graph):

```
INTAKE → PLANNING → SPEC_READY → AWAITING_IMPLEMENTATION_APPROVAL
       → IMPLEMENTING → IN_REVIEW → AWAITING_MERGE_APPROVAL
       → MERGED → RETROSPECTIVE → DONE
       (any state → BLOCKED → INTAKE, on failure)
```

- `AWAITING_*` = a row value, no worker running (cheap, restart-safe).
- Transitions are **commands** (§10): the API validates the (from-state →
  to-state) edge, writes the audit row, then enqueues the follow-up job.
- The harness runner (§12) is what *produces* the transitions for
  `IMPLEMENTING` / `IN_REVIEW` / `RETROSPECTIVE` by watching BMAD terminal
  status.

## 4. Technical Decisions (Proposed)

| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Development protocol** | **BMAD Method** (`bmad-method` npm) | Battle-tested plan/spec/build/review/retro; designed for an external orchestrator; configurable via `_bmad/custom`; no forking |
| **Unattended epic runner** | **bmad-loop** (pinned tag, Python) | Deterministic ordered scheduler + worktree isolation + `opencode` driver; pre-1.0 → pin & keep replaceable |
| **Coding harness** | **OpenCode** (CLI, Node) | Drives BMAD skills; OpenAI-compatible client → points at llama.cpp; already the chosen harness |
| **Test / gate evidence** | **TEA** (`bmad-method-test-architecture-enterprise`) — *optional* | Adds headless `PASS/CONCERNS/FAIL/WAIVED` + exit codes for gates; evaluate after pilot |
| **Creative Intelligence Suite** | **Not now** | Not foundational; revisit only if strategy/ideation workflows are wanted |
| **Control-plane language** | **TypeScript** | One language end-to-end for MIC; Node 22.22.1 present |
| **API framework** | **Fastify** | Fast, schema-first (TypeBox), built-in SSE via raw reply |
| **Workflow engine** | **Postgres state machine + pg-boss** (LangGraph *optional*) | Lifecycle is a DB state machine; jobs via pg-boss. LangGraph only if a non-software workflow needs durable multi-step graphs |
| **Database** | **PostgreSQL 16+** (Ubuntu 26.04) | Durable state + queue + audit; pgvector ready for later |
| **ORM / schema** | **Drizzle ORM** (TypeScript) | Type-safe, SQL-first, plays well with pg-boss; migrations in-repo |
| **Job queue / scheduler** | **pg-boss** | Runs on Postgres; priorities, retries, DLQ, cron, scheduling |
| **Model plane** | **llama.cpp** (`llama-server`, OpenAI-compat HTTP) | Already built with HIP (ROCm); OpenCode + BMAD agents call it |
| **Models** | GPT-OSS 120B F16 (default); specialist models optional | The installed 61 GiB GGUF fits the APU's unified 122 GB memory; admission still checks live resources |
| **Frontend (PWA)** | **React + Vite + TypeScript** | Fast, typed, easy PWA |
| **Realtime** | **SSE** (server→client) | One-directional; no WS infra needed |
| **Voice** | **Whisper** (STT) + a local TTS (e.g. Piper) | STT local; TTS local for privacy |
| **Auth** | Single-user local: **API token** + OS user | No user system needed for a personal system |
| **Config** | `.env` + `zod` validation | Fail fast on missing keys |
| **Process management** | **systemd** services | Survives reboots, auto-restart |
| **Tests** | **Vitest** | TypeScript-native, fast |
| **Lint / format** | **ESLint** + **Prettier** | Consistent code |
| **n8n integration** | n8n **webhooks** (inbound + outbound) | Triggers enter via webhook; MIC calls n8n for edge actions |

## 5. Domain Model & Data Schema

MIC's state lives in Postgres. The schema is split across schemas: `mic_core`
(MIC's own tables, managed by Drizzle migrations) and pg-boss's own schema (its
tables, managed by pg-boss). LangGraph is *not* in the core; if a non-software
workflow later needs it, it gets its own schema (`langgraph`).

### 5.1 Entities

- **Project** — a git repo Michael wants MIC to develop (e.g. `parliament_people_product_development`).
- **WorkItem** — a unit of work. Types: `feature`, `bug`, `task`. This is the
  spine of the lifecycle state machine (§3.8).
- **Story** — a BMAD story, from a spec's `stories.yaml`. 1 WorkItem : 1..N
  Stories. Stories carry BMAD's status and are the unit `bmad-build-auto` runs
  on.
- **Run** — one dispatch of a BMAD skill / workflow (e.g. `bmad-spec`,
  `bmad-build-auto`, `bmad-loop`, `bmad-retrospective`) against a work item /
  story, in a fresh harness session. Records model, tokens, cost, status.
- **Artifact** — a file produced or consumed by a run or the repo (spec,
  stories.yaml, PRD, architecture, diff, test-report, retro, result.json).
- **Question** — a pending human question (the human-in-the-loop primitive);
  carries its resume reference (which run/story/spec to continue).
- **Evidence / Gate** — a check (build, test, lint, type-check, AI review, TEA
  verdict) with a pass/fail result; gates a merge.
- **Approval** — Michael's explicit sign-off for a state transition
  (implement, merge, deploy).
- **AuditEvent** — append-only log of every state transition and decision.
- **ModelSchedule** — which model is loaded / scheduled for which window.

### 5.2 Core schema (Drizzle, `mic_core`)

```sql
-- (excerpt; Drizzle is the source of truth, this is the shape)
create table projects (
  id            text primary key,        -- 'prj_<uuid>'
  name          text not null,
  repo_path     text not null,           -- e.g. /home/michael/projects/parliament_people_product_development
  base_branch   text not null default 'main',
  default_model text not null default 'gpt-oss-120b-F16',
  bmad_configured boolean not null default false,  -- has _bmad/custom been applied?
  created_at    timestamptz not null default now()
);

create table work_items (
  id          text primary key,          -- 'wi_<uuid>'
  project_id  text not null references projects(id),
  kind        text not null,             -- 'feature' | 'bug' | 'task'
  title       text not null,
  spec_path   text,                      -- repo-relative path to the BMAD spec
  intent      text,                      -- raw user intent (from intake)
  state       text not null default 'INTAKE',  -- §3.8 state machine
  priority    int  not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index wi_state_idx   on work_items(project_id, state);
create index wi_priority_idx on work_items(state, priority)
  where state in ('INTAKE','PLANNING');
```

```sql
create table stories (
  id            text primary key,        -- 'st_<uuid>'
  work_item_id  text not null references work_items(id),
  story_id      text not null,           -- BMAD id, e.g. '01' or '01-01'
  title         text not null,
  status        text not null default 'draft',
                 -- draft|ready-for-dev|in-progress|in-review|done|blocked
  order_index   int not null default 0,
  bmad_status   text,                    -- raw BMAD spec-status string (mirror)
  unique (work_item_id, story_id)
);

create table runs (
  id          text primary key,          -- 'run_<uuid>'
  work_item_id text not null references work_items(id),
  story_id    text,                      -- nullable: planning runs aren't story-scoped
  kind        text not null,
                 -- 'bmad-spec'|'bmad-build'|'bmad-build-auto'|'bmad-loop'|'bmad-retrospective'|'research'
  model       text not null,             -- model that actually ran
  worktree    text,                      -- git worktree path used
  status      text not null default 'running', -- running|succeeded|failed|blocked|cancelled
  baseline_revision text,                -- HEAD at dispatch (for diff / reset)
  result_json jsonb,                     -- BMAD result.json (terminal status)
  tokens_in   bigint, tokens_out bigint, cost_usd numeric,
  started_at  timestamptz, finished_at timestamptz,
  error       text
);
create index runs_workitem_idx on runs(work_item_id, started_at desc);

create table questions (
  id          text primary key,          -- 'q_<uuid>'
  run_id      text not null references runs(id),
  work_item_id text not null references work_items(id),
  resume_ref  jsonb,                     -- {spec_path, story_id, kind} — how to continue
  question    text not null,
  context     text,
  answer      text,
  answered_by text default 'michael',
  status      text not null default 'open', -- open|answered|expired
  created_at  timestamptz not null default now(), answered_at timestamptz
);

create table artifacts (
  id          text primary key,
  run_id      text references runs(id),
  work_item_id text references work_items(id),
  kind        text not null,
                 -- 'spec'|'stories'|'prd'|'architecture'|'ux'|'diff'|'test-report'|'retro'|'result'|'research'
  repo_path   text,                      -- repo-relative path (source of truth)
  git_commit  text,                      -- commit that introduced/last-touched it
  content_ref text,                      -- blob/uri if not in-repo
  meta        jsonb
);

create table evidence (
  id          text primary key,
  work_item_id text not null references work_items(id),
  run_id      text references runs(id),
  kind        text not null,             -- 'build'|'test'|'lint'|'typecheck'|'ai-review'|'tea'
  status      text not null,             -- 'pass'|'fail'|'concerns'|'waived'
  summary     text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create table gates (
  id           text primary key,
  work_item_id text not null references work_items(id),
  kind         text not null,            -- 'pre-merge'|'pre-deploy'|'pre-implement'
  status       text not null default 'pending', -- pending|passed|failed|waived
  required     jsonb not null,           -- e.g. {build:'pass',test:'pass',ai_review:'pass'}
  evaluated_at timestamptz
);

create table approvals (
  id            text primary key,
  work_item_id  text not null references work_items(id),
  gate_id       text references gates(id),
  transition    text not null,           -- e.g. 'AWAITING_MERGE_APPROVAL -> MERGED'
  approved      boolean not null,
  decided_by    text default 'michael',
  note          text,
  decided_at    timestamptz not null default now()
);

create table audit_events (
  id           bigint generated always as identity primary key,
  work_item_id text references work_items(id),
  run_id       text references runs(id),
  actor        text not null,            -- 'michael'|'mic'|'bmad-loop'|'n8n'
  event        text not null,            -- e.g. 'state:IMPLEMENTING->IN_REVIEW'
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create table model_schedules (
  id            text primary key,
  model         text not null,
  window_start  timestamptz,             -- null = on-demand
  window_end    timestamptz,
  priority      int not null default 100,
  reason        text
);

create table n8n_triggers (
  id          text primary key,
  project_id  text references projects(id),
  source      text not null,             -- 'github'|'gmail'|'calendar'|'webhook'
  event       text not null,
  payload     jsonb,
  consumed    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table notifications (
  id          text primary key,
  channel     text not null,             -- 'pwa'|'email'|'n8n'
  work_item_id text references work_items(id),
  kind        text not null,             -- 'awaiting_approval'|'blocked'|'done'
  payload     jsonb,
  sent_at     timestamptz
);
```

### 5.3 Mapping to the `parliament_people_product_development` repo + BMAD artifacts

The repo is the source of truth for *artifacts*; Postgres mirrors
*orchestration state*. For `parliament_people_product_development`:

| MIC entity | Repo location |
|------------|---------------|
| Project | the repo root (`/home/michael/projects/parliament_people_product_development`) |
| BMAD config | `_bmad/` (from `bmad-method install`) + `_bmad/custom/*.toml` |
| PRD / UX / Architecture | `_bmad/output/artifacts/` (or wherever `_bmad/custom` sets `planning_artifacts.location`) |
| Spec + `stories.yaml` | BMAD spec location (repo-relative `spec_path` on `work_items`) |
| Story | a row in `stories.yaml` (indexed into `stories`) |
| Diff / test-report / retro | committed or in `_bmad/output/`; indexed into `artifacts`/`evidence` |

The **BMAD Adapter & Indexer (§13)** reads BMAD files after each run and upserts
them into Postgres. On drift, **re-index wins** (re-read the repo).

## 6. The Lifecycle (Revised): Durable State Machine + BMAD Protocol + Fresh Sessions

The lifecycle is a **Postgres state machine** (§3.8). Each state that "does
work" maps to a **BMAD skill** run in a **fresh OpenCode session** by the
harness runner (§12). Waiting states cost nothing. There is no LangGraph graph
in the core path.

### 6.1 State → BMAD skill (the mapping)

| MIC state | What happens | BMAD skill / mechanism | Produces |
|-----------|--------------|------------------------|----------|
| `INTAKE` | Capture intent (voice/PWA/n8n) | — (MIC) | `work_items` row |
| `PLANNING` | Right-size; produce plan/spec | `bmad-prd`/`bmad-architecture` (large) or `bmad-spec` (small) | spec + `stories.yaml` |
| `SPEC_READY` | Index stories, show plan | — (MIC indexer) | `stories` rows |
| `AWAITING_IMPLEMENTATION_APPROVAL` | Human gate | — (MIC; question) | `approvals` row |
| `IMPLEMENTING` | Build the approved story(s) | `bmad-build-auto` (per story) **or** `bmad-loop` (approved epic) | code + tests + diff |
| `IN_REVIEW` | Deterministic + AI/TEA evidence | build/test/lint + `bmad-build` review or TEA | `evidence` rows |
| `AWAITING_MERGE_APPROVAL` | Human gate on evidence + diff | — (MIC) | `approvals` row |
| `MERGED` | Merge to base branch | — (MIC; git) | merge commit |
| `RETROSPECTIVE` | Verdict + learnings | `bmad-retrospective` (headless) | retro artifact |
| `DONE` | Notify, close | — (MIC) | `notifications` |
| `BLOCKED` | Route to Michael | — (MIC; `blocked` status) | `questions` row |

**Right-sizing** (BMAD guidance): small change → `bmad-build-auto` directly;
larger work → `bmad-spec` → stories; project-level → PRD/UX/architecture →
epics → stories. MIC's planner picks the path and records it in `runs.kind`.

### 6.2 The run / harness model (replaces v1's thread model)

- A **run** is one harness session for one BMAD skill, on one work item /
  story, in one git **worktree**.
- The harness runner (§12):
  1. checks out a **worktree** at `base_branch` (isolation);
  2. records `baseline_revision = HEAD`;
  3. dispatches the BMAD command (e.g. `bmad-build-auto <story>` /
     `bmad-spec --intent …`) to OpenCode, with the model routed per §11;
  4. **watches** `result.json` + spec status + the worktree for completion;
  5. on terminal status, reads the diff + artifacts, writes `runs`
     (`status`, `result_json`, tokens, cost), advances the state machine, and
     enqueues the next job (or routes to a human / `BLOCKED`).
- **No held execution across waits.** A wait is a state value; the next action
  is a new session that reads durable artifacts. BMAD's spec status is what
  lets `bmad-build-auto` resume a partially-progressed story.

### 6.3 Parallel technical discovery

BMAD builds one story per session (fresh context). MIC gets parallelism the
right way: **multiple worktrees, multiple runs, coordinated by the queue**
(§11) — never a single giant session. Independent stories within an approved
epic can run in parallel worktrees (subject to the single-model constraint:
they share the loaded model; GPU-bound work is serialized or batched). This is
the "fan-out" we keep in MIC, not in a graph.

### 6.4 Typed handoff envelopes (unchanged, now BMAD-scoped)

Between MIC states, handoffs are structured, typed envelopes (not free text)
so each skill starts with exactly the context it needs:

- `IntakeEnvelope { workItemId, projectId, intent, source }`
- `PlanEnvelope { workItemId, specPath, stories[], rightSizing }`
- `BuildEnvelope { workItemId, storyId, specPath, worktree, baseline, model }`
- `ReviewEnvelope { workItemId, storyId, diffRange, evidence[] }`
- `MergeEnvelope { workItemId, baseBranch, gateId, evidence[] }`

Envelopes are small; heavy context lives in the repo (spec, stories, diff),
referenced by path — keeping each fresh session's context bounded.

## 7. The Repository as Durable Artifact Store

The git repo is the **source of truth for artifacts**; Postgres is the index
and the source of truth for orchestration state. This is what makes the system
auditable and restart-resilient.

### 7.1 Artifact contract

Every artifact BMAD (or MIC) produces is:
- a **file in the repo** (committed or in a known output dir) — e.g. spec,
  `stories.yaml`, PRD, architecture, diff, test-report, retro, `result.json`;
- indexed in the `artifacts` table with `repo_path`, `git_commit`, `kind`,
  `meta` (the BMAD Adapter, §13, does this after each run).

The contract: an artifact is *real* when it exists at `repo_path` at
`git_commit` (or is captured in the worktree). Postgres rows are pointers, not
copies — the file is authoritative.

### 7.2 Provenance query (how "where are we" works)

Given a work item, provenance is a join across runs → artifacts → evidence →
gates → approvals → audit:

```sql
-- "what happened to work item wi_x, and what evidence exists?"
select
  wi.state,
  r.id as run, r.kind, r.model, r.status,
  a.kind as artifact, a.repo_path, a.git_commit,
  e.kind as evidence, e.status as evidence_status
from work_items wi
left join runs      r  on r.work_item_id = wi.id
left join artifacts a  on a.run_id = r.id
left join evidence  e  on e.run_id = r.id
where wi.id = $1
order by r.started_at, e.created_at;
```

The PWA "where are we" view is exactly this query, grouped by work item — no
re-derivation from LLM state.

### 7.3 Idempotency & resume rule (BMAD-aware)

- A **run** is idempotent by `(work_item_id, kind, story_id, baseline_revision)`:
  re-dispatching the same story on the same baseline reuses/overwrites the
  prior run's artifacts rather than forking.
- **Resume is BMAD's, not MIC's:** on re-dispatch, MIC passes the existing spec
  + story; `bmad-build-auto` resumes from the spec status. MIC does not replay a
  graph.
- **Reset is a git operation:** to abandon a run, discard the worktree
  (`git worktree remove`) and revert state; the base branch is untouched
  because runs happen in isolated worktrees.
- On **MIC restart**, nothing is "mid-graph": pending work is in pg-boss
  (durable) and in-flight sessions are detected via `runs.status='running'` +
  liveness; the harness runner re-attaches to their `result.json` or marks them
  and re-dispatches.

## 8. Model Plane (llama.cpp)

The model plane is a single llama.cpp `llama-server` exposing an
**OpenAI-compatible HTTP API**. OpenCode (and therefore BMAD's agents) point at
it; MIC's router decides *which* model is loaded.

### 8.1 Models
| Model | Quant | Size | Use | Notes |
|-------|-------|------|-----|-------|
| **GPT-OSS 120B** | F16 preset | 61 GiB GGUF | Default: spec/build/review | Approved normal MIC model; fits unified memory subject to admission checks |
| Qwen3-VL:32B | (per availability) | large | Vision (screenshots, UI) | Optional; loaded on demand |

### 8.2 Server (systemd service)
```bash
# The installed model is /srv/models/gpt-oss-120b/gpt-oss-120b-F16.gguf
llama-server \
  -m /srv/models/gpt-oss-120b/gpt-oss-120b-F16.gguf \
  --port 8080 --host 127.0.0.1 \
  -ngl 99 \                    # offload all layers to the APU (ROCm/HIP)
  -c 32768 \                   # context (fit to the unified memory pool; tune in pilot)
  --jinja                      # enable chat template (tool-calling)
```
- **GPU is AMD Strix Halo (ROCm/HIP):** the binary is built with HIP; weights
  come from the unified 122 GB pool, so there is no tight VRAM ceiling like a
  discrete GPU.
- Service: `mic-llama.service` (systemd, `Restart=on-failure`).
- Health: `GET /health` (or `/v1/models`) polled by the model router.
- **Single-slot:** loading a different model = restart the server (or a second
  server on another port). The router treats "model ready" as a prerequisite
  before dispatching a run (§11).

### 8.3 How OpenCode / BMAD reach it
OpenCode is configured with an OpenAI-compatible provider pointing at
`http://127.0.0.1:10000/v1`, model name `gpt-oss-120b-F16`. BMAD's prompts run as
OpenCode sessions, so they use this endpoint transparently. No cloud API key —
a local token only.

## 9. PostgreSQL Install & Init

Ubuntu 26.04 ships a recent PostgreSQL (16/17). One cluster `mic` (local socket + loopback).

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE ROLE mic LOGIN PASSWORD '${MIC_DB_PASS}';"
sudo -u postgres createdb -O mic micdb
```
- **Schemas in one DB:** `mic_core` (Drizzle migrations), `pgboss` (pg-boss
  creates it), and optionally `langgraph` (only if a non-software workflow is
  added later).
- **Connection string** (in `.env`, validated by zod):
  `postgresql://mic:${MIC_DB_PASS}@127.0.0.1:5432/micdb`
- **Migrations:** Drizzle Kit generates SQL; applied at service start
  (`drizzle-kit migrate`) and in CI. pg-boss runs its `schema()` on init.
- **Backups:** nightly `pg_dump` to `~/.mic/backups/` (systemd timer).

The DB is the durability backbone: state machine + queue (pg-boss) + audit all
live here, so a reboot loses nothing.

## 10. The Control API (Fastify)

A single Fastify service (`mic-api`) is the only thing the PWA / voice / n8n
talk to. It exposes **commands** (state transitions) and **queries**, plus an
SSE stream.

### 10.1 Auth
Single-user local: `Authorization: Bearer ${MIC_API_TOKEN}`. n8n inbound
webhooks carry a shared secret. No user model.

### 10.2 Endpoints (v1)
- `POST /work-items` — intake (creates row, state `INTAKE`); body = intent.
- `GET  /work-items`, `GET /work-items/:id` — list/detail (incl. provenance §7.2).
- `POST /work-items/:id/approve` — approve/reject a pending gate (decision, note).
- `POST /work-items/:id/dispatch` — manually trigger the next BMAD run.
- `POST /work-items/:id/cancel` — abandon (discards worktree, reverts state).
- `GET  /questions`, `POST /questions/:id/answer` — human-in-the-loop.
- `GET  /projects`, `POST /projects` — register a repo (triggers BMAD install §13).
- `GET  /models` — loaded model + queue (from the router).
- `GET  /events` — **SSE** stream of state changes / notifications (live UI).
- `POST /webhooks/n8n` — inbound triggers from n8n.

### 10.3 Command pattern (state transitions)
Every mutating action is a **command handler**:
1. load the work item; 2. validate the (from-state → to-state) edge against the
§3.8 machine (reject invalid edges with 409); 3. write the `approvals` /
`audit_events` row in the same transaction; 4. `commit`; 5. **enqueue the
follow-up job** in pg-boss (e.g. after approval → `harness.build`); 6. emit an
SSE event.

This keeps the state machine the *only* writer of `work_items.state`, so the UI
and the workers can never disagree.

## 11. Queue, Scheduler & Model/GPU Scheduling (pg-boss)

pg-boss runs on the same Postgres. One worker process (`mic-worker`) consumes
jobs; priorities, retries, DLQ, and cron come from pg-boss.

### 11.1 Jobs
| Queue | Trigger | Work |
|-------|---------|------|
| `harness.plan` | INTAKE→PLANNING | run BMAD spec/prd/architecture (§12) |
| `harness.build` | approve implement | run `bmad-build-auto` / `bmad-loop` (§12) |
| `harness.review` | build terminal | deterministic + AI/TEA evidence (§14) |
| `harness.merge` | approve merge | merge worktree → base branch |
| `harness.retro` | merged | `bmad-retrospective` |
| `index.bmad` | any run terminal | index BMAD artifacts → Postgres (§13) |
| `notify` | state change | SSE + n8n/email |

### 11.2 Model/GPU scheduling (the single-slot problem)
- The **model router** owns the `model_schedules` table + a lock. Before a job
  that needs model `M`, it ensures `M` is loaded (a load is itself a serialized
  job).
- **Batch by model:** the scheduler groups ready jobs by required model to
  amortize reloads. Vision work (32B) is scheduled into explicit windows.
- **Never strand a run mid-model-swap:** a run holds the loaded model for its
  lifetime; a swap only happens between runs.
- **Overnight batch:** a cron trigger fires a batch of low-priority
  `harness.build` jobs at night (higher throughput, less Michael-attention).

### 11.3 Retries & dead-letter
- Transient failures (model timeout, OOM) → pg-boss retry with backoff (max N).
- `blocked` (BMAD) → **not** a retry; routed to `questions` for Michael (§12).
- After max retries → DLQ + `BLOCKED` state + notification.

## 12. The Harness Runner (the MIC ↔ BMAD seam)

This is the heart of the revised design: a worker that turns a **job** into a
**fresh OpenCode/BMAD session in a worktree**, watches it to a terminal status,
and turns that status back into a **state transition**. It does *not* assume
success — it reads evidence.

### 12.1 Dispatch (job → session)
For a `harness.build` job (work item `wi`, story `st`, model `M`):
1. `git worktree add ~/.mic/wt/<wi>/<st> <base_branch>` (isolation).
2. `baseline_revision = git rev-parse HEAD` (in the worktree).
3. Ensure model `M` loaded (§11). Write a `runs` row: `kind`, `model`,
   `worktree`, `baseline_revision`, `status=running`.
4. Build the command per `kind`:
   - `bmad-build-auto`: `opencode run <bmad-build-auto> --story <st> --spec <spec_path>`
   - `bmad-spec`: `opencode run <bmad-spec> --intent "<intent>"`
   - `bmad-loop`: the (pinned) `bmad-loop` CLI with the epic folder +
     `opencode` driver (for approved, unattended epics).
5. Spawn the process (child process), streaming stdout to a log file.

### 12.2 Monitor (session → status)
The runner watches, with a timeout, for:
- **`result.json`** (BMAD's terminal-status artifact) — primary signal.
- **spec status** in the spec frontmatter / `stories.yaml` (for resumption).
- **git diff** in the worktree vs `baseline_revision` (what actually changed).
- **process exit** + exit code (a safety net; not the source of truth).

### 12.3 Map terminal status → MIC state
| BMAD terminal | `runs.status` | MIC action |
|---------------|---------------|------------|
| `done` / success + tests pass | `succeeded` | → `IN_REVIEW` (enqueue `harness.review`) |
| `in-review` | `succeeded` | → `IN_REVIEW` |
| `failed` / tests fail | `failed` | retry (≤N) then → `BLOCKED` |
| **`blocked` (e.g. `no subagents`)** | `blocked` | → route to Michael: create a `questions` row; offer single-agent fallback; do **not** blind-retry |
| timeout / crash | `failed` | re-dispatch or → `BLOCKED` |
| `accepted-with-open-items` (retro) | `succeeded` | → `DONE` with open items surfaced |

The runner writes `runs.result_json` + the diff, then calls the API's command
pattern (§10.3) so the state transition goes *through* the state machine, not
around it.

### 12.4 Why this is the risky, novel part
- The `result.json`/status contract is **BMAD's** and can change between
  versions → pin BMAD + bmad-loop versions (§13) and keep the parser in one
  place with a test against a captured fixture.
- `blocked: no subagents` is the local-harness compatibility risk — the pilot
  (§3.7) must confirm whether OpenCode with the default GPT-OSS 120B exposes subagents to BMAD, and how
  to fall back to single-agent build.
- Fresh context per story is the win; the cost is that BMAD re-reads the repo
  each run (fine — it's local and cheap).

## 13. The BMAD Adapter & Indexer

The adapter makes BMAD "ours" without forking, and keeps Postgres in sync with
BMAD's file-based state.

### 13.1 Install & configure (per project, idempotent)
```bash
# in the project repo (run once; recorded via projects.bmad_configured)
npx bmad-method install            # creates _bmad/
```
Then MIC writes `_bmad/custom/*.toml` overrides (the customization layer — no
upstream edits):
- **persona** — who the agents act as (e.g. "senior engineer for parliament_people_product_development").
- **principles** — org rules (conventions, test policy, "never push to main").
- **persistent_facts** — stable project facts (stack, ports, deploy targets).
- **planning_artifacts.location** — where PRD/spec/stories land (so the indexer
  knows where to look).
- **workflow behavior overrides** — e.g. require tests; single-agent build if
  subagents unavailable.

MIC generates these from the `Project` config + Michael's org profile; they are
**committed** to the repo (reviewable, versioned).

### 13.2 Version pinning
BMAD core and bmad-loop are pinned to specific versions recorded per project
(`projects.bmad_version`, and a pinned bmad-loop tag). Upgrades are deliberate,
with the §12.3 status-parser fixture re-tested first. Rationale: bmad-loop is
pre-1.0.

### 13.3 Indexer (files → Postgres)
After every terminal run, the `index.bmad` job reads the repo and upserts:
- spec frontmatter + `stories.yaml` → `work_items.spec_path`, `stories` rows
  (`status`, `bmad_status`).
- PRD / architecture / UX / retro files → `artifacts` rows.
- `result.json` → `runs.result_json`.

**Rule: re-index wins.** If Postgres and the repo disagree, the repo is
re-read. This makes the DB a cache of the repo, not a rival source of truth.

## 14. Gates & Evidence (deterministic first, then AI)

Gates are the merge/deploy protections; evidence is what a gate is made of.
Deterministic checks run first and cheaply; AI/TEA review adds judgment.

### 14.1 Evidence kinds
- **Deterministic** (always): `build`, `test`, `lint`, `typecheck` — run in the
  worktree by the `harness.review` job; result → `evidence` rows.
- **AI review** (BMAD): `bmad-build`'s review step (or a dedicated review pass)
  → `evidence kind='ai-review'`.
- **TEA (optional, later):** if adopted, TEA runs headless and emits
  `PASS / CONCERNS / FAIL / WAIVED` + an exit code → `evidence kind='tea'`. TEA
  is evaluated *after* the pilot, only if we want its evidence format.

### 14.2 Gate evaluation
A `gates.required` spec (e.g. `{build:'pass', test:'pass', ai_review:'pass'}`)
is checked against the `evidence` rows for the work item:
- all required present + pass → gate `passed` → work item
  `AWAITING_MERGE_APPROVAL`.
- any required fail/missing → gate `failed` → `BLOCKED` (route to Michael).
- `concerns`/`waived` → gate `passed` **but flagged** for Michael at approval
  (never auto-merge on a flagged gate).

### 14.3 Mapping to planning-grade / implementation-grade gates
- **Planning-grade** (before implement): spec exists, stories present, tests
  specified — a `pre-implement` gate.
- **Implementation-grade** (before merge): the §14.2 gate above.
- **Deploy-grade** (before deploy): implementation-grade + (if used) TEA `PASS`
  + smoke test — a `pre-deploy` gate.

## 15. n8n Integration (edges)

n8n is the *edge* layer; MIC is the *brain*. They meet at webhooks.

- **Inbound (n8n → MIC):** n8n nodes (GitHub issues, Gmail, Calendar, RSS,
  forms) hit `POST /webhooks/n8n` with a shared secret + a typed trigger
  `{source, event, payload}`. MIC stores it in `n8n_triggers` and, if it maps
  to a project, creates/updates a `work_item` (state `INTAKE`).
- **Outbound (MIC → n8n):** MIC calls n8n webhook URLs for side effects it
  doesn't own — send email, post to a channel, create a calendar hold, trigger
  a deploy pipeline. These are the `notify` job's targets.

MIC never re-implements integrations; n8n owns connectors, MIC owns decisions.
A trigger is "consumed" once it produced a work item or an explicit no-op.

## 16. Voice Layer

Voice is another input/output channel to the **same Control API** — it does
not bypass it.

- **STT:** Whisper (local) turns speech → text intent → `POST /work-items`.
- **TTS:** a local TTS (e.g. Piper) speaks MIC's responses/notifications.
- **Conversations:** voice maps to the same `questions` / `approvals`
  endpoints — "approve the merge for wi_x" → `POST /work-items/:id/approve`.
- Voice is best for *status* ("where are we on wi_x?") and *approvals*; typed
  input is better for *intake detail*. Both write the same rows.

## 17. The PWA (frontend)

React + Vite + TypeScript, installable, offline-tolerant, talking to the
Control API + SSE. It is the primary surface for Michael.

Key views:
- **Dashboard ("where are we"):** all projects → work items grouped by state
  (§3.8), a count per state, live-updating via SSE.
- **Work-item detail:** the provenance view (§7.2) — timeline of runs,
  artifacts (link to spec/diff in the repo), evidence, gates, approvals.
- **Approvals:** pending gates across all projects, diff + evidence
  side-by-side, one-tap approve/reject (with note).
- **Intake:** quick "new work item" (typed) + mic button (voice).
- **Runs:** live run list with model, status, log tail; cancel button.
- **Models/queue:** loaded model, pending model swaps, queue depth.

No business logic in the frontend — it renders API state and fires commands.

## 18. Build Phases (revised, pilot-first)

Each phase names deliverable + owner + verification. **Phase 0 is a hard gate.**

**Phase 0 — BMAD Pilot (HARD GATE).** *Deliverable:* written assessment
(§3.7). *Steps:* download Q8; `bmad-method install` in a scratch repo; manual
`bmad-spec`→`bmad-build-auto` on a real story; unattended second story;
bmad-loop on a small epic; `bmad-retrospective`. *Verify:* all §3.7 exit
criteria met; timing profile captured. *If it fails → stop and re-decide model
strategy.* No control-plane code before this passes.

**Phase 1 — Infra.** *Deliverable:* Postgres (`mic` cluster, `mic_core` schema,
Drizzle migrations, nightly backup) + `mic-api` Fastify skeleton (auth + health
+ SSE) + systemd units. *Verify:* migrations apply; API returns health; SSE
stream connects; survives reboot.

**Phase 2 — Model plane.** *Deliverable:* llama.cpp systemd service (Q8),
router + `model_schedules`, model-load job. *Verify:* `/v1/models` lists Q8;
router reports "ready"; a trivial OpenCode completion via the endpoint works.

**Phase 3 — Harness runner + BMAD adapter.** *Deliverable:* §12 runner
(worktree, dispatch, monitor, status map) + §13 adapter (install,
`_bmad/custom`, indexer). *Verify:* dispatch `bmad-build-auto` on a story from a
job; a `done` status flips the work item to `IN_REVIEW`; artifacts indexed;
`blocked` routes to a question.

**Phase 4 — Queue & model scheduling.** *Deliverable:* pg-boss queues,
priorities, retries/DLQ, model batching, overnight cron. *Verify:* enqueue N
build jobs; they batch by model; a failure retries then DLQs; a model swap
happens between runs only.

**Phase 5 — Gates & evidence.** *Deliverable:* §14 deterministic + AI review;
gate evaluation; (optional) TEA. *Verify:* a passing build advances to
`AWAITING_MERGE_APPROVAL`; a failing test blocks; a flagged gate requires a
human.

**Phase 6 — n8n edges.** *Deliverable:* inbound webhook → work item; outbound
notify → n8n. *Verify:* a GitHub issue creates a work item; a done item posts
to a channel.

**Phase 7 — Voice.** *Deliverable:* Whisper STT + Piper TTS wired to the API.
*Verify:* spoken intake creates a work item; spoken approval transitions state.

**Phase 8 — PWA.** *Deliverable:* dashboard, detail/provenance, approvals,
intake, runs, models. *Verify:* live-updating dashboard; end-to-end approve in
the UI.

**Phase 9 — Hardening & acceptance.** *Deliverable:* run §20 scenarios; audit
log complete; restart-safe; docs. *Verify:* all §20 pass.

## 19. Risks, Mitigations & Open Questions

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Local model (Q8) can't run BMAD reliably | High | Phase 0 hard gate; fallback to bigger/different/hybrid model |
| 2 | bmad-loop pre-1.0 churn | Med | Pin a tag; treat as replaceable; fall back to `bmad-build-auto` |
| 3 | `blocked: no subagents` on local harness | Med | Pilot confirms behavior; single-agent fallback path in runner |
| 4 | BMAD status contract (`result.json`) changes | Med | Pin versions; parser in one place + fixture test |
| 5 | Two sources of truth (files vs DB) | Med | Adapter re-index-wins; repo authoritative for artifacts |
| 6 | Single GPU model-slot contention | Med | Router batches by model; swaps only between runs; vision windows |
| 7 | Long local builds (slow, high token) | Med | Fresh context per story; overnight batch; model-tuning from pilot |
| 8 | Non-software work has no BMAD path | Low (later) | Deferred: custom LangGraph/agent workflow via the same runner |

**Open questions (decide during the pilot):**
- Does OpenCode expose BMAD subagents to a local model? (drives risk #3)
- Q8 context size that fits the unified memory pool with headroom for a build session?
- Human vs unattended default per work-item kind (the autonomy policy).
- Whether TEA's evidence format is worth adopting over raw build/test + BMAD
  review.

## 20. Acceptance Criteria

The system is "done" for v1 when, end to end, on the local stack:
1. Michael speaks/types an intent → a `work_item` appears in `INTAKE`.
2. MIC runs BMAD planning (`bmad-spec`) → spec + `stories.yaml` exist in the
   repo and are indexed; state = `SPEC_READY`.
3. MIC asks Michael to approve implementation (PWA/voice) → approval recorded.
4. MIC runs `bmad-build-auto` in a worktree → code + tests + diff; a `done`
   status advances state to `IN_REVIEW`.
5. Deterministic + AI evidence is produced; a passing gate moves to
   `AWAITING_MERGE_APPROVAL`.
6. Michael approves merge → merged to base branch; `bmad-retrospective` runs →
   state `DONE`; Michael is notified.
7. A `blocked`/failed run routes to Michael with a question (not a blind retry).
8. **Restart-safe:** kill MIC mid-`AWAITING_*` and restart → nothing lost;
   pending jobs resume; in-flight runs are re-attached or re-dispatched.
9. **Auditable:** every transition has an `audit_events` row; the provenance
   query (§7.2) reconstructs the full history of any work item.
10. **Local:** all of the above runs on `themachine` with Q8 — no cloud LLM.

## Appendix A: BMAD skill → MIC lifecycle mapping

| BMAD skill / workflow | MIC `runs.kind` | MIC state(s) it serves |
|-----------------------|-----------------|--------------------------|
| `bmad-prd` | `bmad-prd` | PLANNING (project-level) |
| `bmad-ux`, `bmad-architecture` | `bmad-spec` | PLANNING (project-level) |
| `bmad-spec` | `bmad-spec` | PLANNING (feature) |
| `bmad-create-epics-and-stories` | `bmad-spec` | PLANNING → SPEC_READY |
| `bmad-build` (interactive) | `bmad-build` | IMPLEMENTING (human-driven) |
| `bmad-build-auto` | `bmad-build-auto` | IMPLEMENTING (unattended, one story) |
| `bmad-loop` | `bmad-loop` | IMPLEMENTING (unattended, approved epic) |
| `bmad-build` review / TEA | (evidence) | IN_REVIEW |
| `bmad-finish` / finish-an-epic | (evidence) | IN_REVIEW → merge readiness |
| `bmad-retrospective` | `bmad-retrospective` | RETROSPECTIVE |

## Appendix B: Runbook (exact commands)

```bash
# --- Model plane ---
# The router preset names gpt-oss-120b-F16 as MIC's default model.
llama-server --models-preset /srv/ai/llama-models.ini --models-max 1 \
  --host 127.0.0.1 --port 10000
curl -s http://127.0.0.1:10000/v1/models

# --- PostgreSQL ---
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE ROLE mic LOGIN PASSWORD 'secret';"
sudo -u postgres createdb -O mic micdb

# --- BMAD (per project) ---
cd /home/michael/projects/parliament_people_product_development
npx bmad-method install            # creates _bmad/
# MIC then writes _bmad/custom/*.toml (persona, principles, persistent_facts,
# planning_artifacts.location, workflow overrides)

# --- bmad-loop (PINNED tag — do not use latest) ---
uvx --from "bmad-loop==<PINNED_TAG>" bmad-loop --help

# --- OpenCode (harness), pointed at the local model ---
# config: OpenAI-compatible provider -> http://127.0.0.1:8080/v1
opencode run <bmad-build-auto> --story 01 --spec path/to/spec.md
```

## Appendix C: Verified sources (as of 2026-09-02)

- **BMAD-METHOD:** `README`, `build-a-change.md`, `customize-bmad.md`,
  `autonomous-development-loops.md`, `finish-an-epic.md`,
  `choose-a-planning-path.md` — right-sizing, `_bmad/custom`, `bmad-build-auto`
  terminal status, and the spec-status resume table.
- **bmad-loop** README — deterministic Python orchestrator, fresh-context
  coding-agent sessions, worktree isolation, `opencode` driver, ordered story
  scheduler, pre-1.0/beta → **pin a version**.
- **TEA** (`bmad-method-test-architecture-enterprise`) — headless
  `PASS / CONCERNS / FAIL / WAIVED` + exit codes (optional, for gates).
- **Environment (verified on `themachine`):** Python 3.14.4, `uv`, git 2.53,
  Node 22.22.1, llama.cpp built, GPT-OSS 120B F16 installed.
- BMAD core is installable + customizable **without editing upstream files**
  (`_bmad/custom` config, persistent facts, org rules, artifact locations).
