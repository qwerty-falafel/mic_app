#!/usr/bin/env -S npx tsx
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { command, commandPass, type CommandResult } from './phase0/process.js';
import { inventory, changedArtifacts, capture, markdownContract, hasCompletedSubagent, events } from './phase0/artifacts.js';
import { sampleResources, summarizeResources, resourcesPass } from './phase0/resources.js';
import { parse as parseYaml } from 'yaml';

interface Check { name: string; status: 'pass' | 'fail' | 'not-run'; detail: string; evidence?: string }
export function validationPass(checks: Check[]): boolean { return checks.length > 0 && checks.every(c => c.status === 'pass'); }
function json(path: string, value: unknown) { mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); }

export async function validate(options: { root: string; live: boolean; timeoutMs: number; model?: string; router?: string }) {
  const root = resolve(options.root);
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const output = join(root, 'test/fixtures/phase0', runId), scratch = join(root, '.phase0', runId);
  mkdirSync(output, { recursive: true }); mkdirSync(scratch, { recursive: true });
  const checks: Check[] = [];
  const check = (name: string, pass: boolean, detail: string, evidence?: string) => {
    checks.push({ name, status: pass ? 'pass' : 'fail', detail, evidence });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
  };
  const skip = (name: string, detail: string) => { checks.push({ name, status: 'not-run', detail }); console.log(`NOT RUN ${name}: ${detail}`); };
  const config = JSON.parse(readFileSync(join(root, 'opencode.json'), 'utf8'));
  const model = options.model ?? config.model;
  if (typeof model !== 'string' || !model.includes('/')) throw new Error('An explicit provider/model is required');
  const [provider, ...parts] = model.split('/'), modelId = parts.join('/');
  const router = (options.router ?? 'http://127.0.0.1:10000').replace(/\/$/, '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(router).hostname)) throw new Error('Phase 0 requires a local router');
  const request = async (path: string, init: RequestInit = {}, timeout = 5000) => {
    const start = performance.now();
    const response = await fetch(router + path, { ...init, signal: AbortSignal.timeout(timeout) });
    const body = await response.json();
    return { status: response.status, durationMs: performance.now() - start, body };
  };
  const run = (name: string, argv: string[], cwd = root, timeout = 15000, env = process.env) => command(argv, cwd, join(output, name), timeout, env);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 15000 }).trim();
  const reports = () => {
    const passed = validationPass(checks);
    const report = { runId, generatedAt: new Date().toISOString(), model, router, live: options.live, passed,
      signOff: { status: 'pending', approver: null }, scratch, checks };
    json(join(output, 'validation.json'), report);
    const lines = ['# Phase‑0 Execution Validation Report', '', `Generated: ${report.generatedAt}`, `Run: \`${runId}\``,
      `Model: \`${model}\``, `Router: \`${router}\``, '', `**Automated result: ${passed ? 'PASS' : 'INCOMPLETE — see failed and unrun checks'}.**`,
      'Sprint 01 is accepted as sufficient to proceed with deferred validation. This script reports evidence and never records product approval.', '', '## Decision matrix', '',
      '| Check | Result | Finding | Evidence |', '|---|---|---|---|',
      ...checks.map(c => `| ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${c.evidence ? `[capture](../${relative(root, join(output, c.evidence))})` : '—'} |`), '',
      '## Reproduce', '', '```sh', 'npm ci', 'npm run build', 'npm test', `npm run phase0 -- --live --model ${model} --timeout-ms ${options.timeoutMs}`, '```', '',
      'Omit `--live` for discovery only; discovery deliberately exits nonzero because execution is unvalidated.',
      `Raw commands, telemetry, resource samples and inventories: [this run](../${relative(root, output)}/validation.json).`,
      `Scratch repositories: \`${scratch}\`. Each validation uses new directories and preserves prior captures.`, '',
      '## Contract corrections', '',
      '- BMAD is installed as skills invoked through OpenCode, not a `bmad plan` / `bmad build-auto` CLI.',
      '- Inspect agents with `opencode agent list`. Build Auto is a skill, not an agent named build-auto. Completed task tool events prove subagent execution.',
      '- Installed Build Auto writes YAML frontmatter status and an Auto Run Result section in Markdown. Capture actual paths, including hidden .memlog.md, rather than manufacturing result.json.',
      '- bmad-loop uses `run --project <root> --spec <folder> --max-stories 2`. Its validate command is only preflight.',
      '- The combined BMM+GDS central config repeats the shorthand `planning_artifacts` key, which Build Auto rendering rejects as ambiguous. The isolated BMM pilot records and uses a minimal central config.',
      '- Newer sprint/epic lifecycle takes precedence over the older implementation plan: multiple repositories per project, both approvals before implementation.', '',
      '## Resource interpretation', '',
      'One-second samples plus command boundaries record RSS and AMD DRM resident GTT/VRAM separately. Their sum is a conservative bound because mappings can overlap. CPU is system utilisation; swap and OOM use counter deltas. Missing GPU measurements fail validation.',
      'Health round-trip, cold inference request, time to first token, generation throughput and total workflow duration are distinct metrics. A non-streaming response may not expose time to first token.', '',
      '## Sources', '', '- Installed manifest and Build Auto workflow are snapshotted under installed/ in this capture.',
      '- [OpenCode CLI](https://opencode.ai/docs/cli/)', '- [bmad-loop](https://github.com/bmad-code-org/bmad-loop)', '',
      '## Sprint handoff', '', 'Sprint 01 is accepted as sufficient to proceed with deferred validation. Failed and unrun checks remain open and will be captured while implementing the execution paths that depend on them.', ''];
    mkdirSync(join(root, 'docs'), { recursive: true }); writeFileSync(join(root, 'docs/phase0-validation.md'), lines.join('\n'));
    return passed;
  };
  try {
    for (const [name, argv] of [['opencode-version', ['opencode', '--version']], ['opencode-agents', ['opencode', 'agent', 'list']],
      ['opencode-cli', ['opencode', 'run', '--help']], ['bmad-loop-version', ['bmad-loop', '--version']],
      ['bmad-loop-cli', ['bmad-loop', 'run', '--help']], ['uv', ['uv', '--version']], ['tmux', ['tmux', '-V']]] as const) {
      const result = await run(name, [...argv]);
      check(name, commandPass(result), commandPass(result) ? (name === 'opencode-agents' ? result.stdout.split('\n').filter(s => /^\w.*\(.*\)$/.test(s)).join(', ') : result.stdout.split('\n')[0]) : result.error ?? result.stderr, `${name}/command.json`);
    }
    for (const path of ['_bmad/config.toml', '_bmad/_config/manifest.yaml', '_bmad/scripts/render_skill.py', '.agents/skills/bmad-build-auto/SKILL.md', '.agents/skills/bmad-build-auto/workflow.md', '.agents/skills/bmad-spec/SKILL.md']) {
      const found = existsSync(join(root, path)); check(`installed:${path}`, found, found ? 'Present' : 'Missing');
      if (found) { mkdirSync(resolve(output, 'installed', path, '..'), { recursive: true }); cpSync(join(root, path), join(output, 'installed', path)); }
    }
    try {
      const manifest = parseYaml(readFileSync(join(root, '_bmad/_config/manifest.yaml'), 'utf8'));
      const modules = Object.fromEntries((manifest.modules ?? []).map((entry: any) => [entry.name, entry.version]));
      check('bmad-version', typeof manifest.installation?.version === 'string',
        `installation ${manifest.installation?.version ?? 'unknown'}; modules ${JSON.stringify(modules)}`,
        'installed/_bmad/_config/manifest.yaml');
    } catch (error) { check('bmad-version', false, String(error)); }
    const modelProcesses = await run('llama-processes', ['ps', '-ww', '-eo', 'pid,ppid,lstart,rss,args']);
    const llamaLines = modelProcesses.stdout.split('\n').filter(line => /llama-server/.test(line));
    check('llama-process', commandPass(modelProcesses) && llamaLines.length > 0,
      llamaLines.length ? `${llamaLines.length} llama-server process(es); full command lines captured` : 'No llama-server process found',
      'llama-processes/stdout.log');
    const llamaSource = '/home/michael/src/llama.cpp';
    if (existsSync(join(llamaSource, '.git'))) {
      const revision = await run('llama-revision', ['git', '-C', llamaSource, 'rev-parse', 'HEAD']);
      check('llama-revision', commandPass(revision) && /^[a-f0-9]{40}\s*$/i.test(revision.stdout),
        revision.stdout.trim() || revision.stderr.trim(), 'llama-revision/command.json');
    } else check('llama-revision', false, `Source checkout not found at ${llamaSource}`);
    let advertised = false, idle = true;
    try {
      const health = await request('/health'); json(join(output, 'router-health.json'), health);
      check('router-health', health.status === 200 && health.body.status === 'ok' && health.durationMs < 200, `${health.status}, ${health.durationMs.toFixed(1)} ms`, 'router-health.json');
      const models = await request('/v1/models'); json(join(output, 'router-models.json'), models);
      advertised = models.status === 200 && models.body.data?.some((m: any) => m.id === modelId);
      check('model-advertised', advertised, modelId, 'router-models.json');
      for (const m of models.body.data ?? []) {
        if (m.status?.value !== 'loaded') continue;
        try {
          const slots = await request(`/slots?model=${encodeURIComponent(m.id)}`);
          json(join(output, `router-slots-${encodeURIComponent(m.id)}.json`), slots);
          if (slots.status !== 200 || !Array.isArray(slots.body) || slots.body.some((s: any) => s.is_processing)) idle = false;
        } catch { idle = false; }
      }
      check('router-idle', idle, idle ? 'Loaded model slots are idle' : 'Active or unobservable inference; do not pre-empt');
    } catch (error) { check('router-health', false, String(error)); }
    if (!options.live || !checks.every(c => c.status === 'pass') || !advertised || !idle) {
      for (const name of ['model-inference', 'planning', 'supervised-build', 'unattended-build', 'subagents', 'blocked', 'blocked-recovery', 'bmad-loop', 'resource-profile']) skip(name, options.live ? 'Prerequisite failure prevents execution' : 'Requires --live');
      return reports();
    }
    const baseLocalConfig = {
      $schema: 'https://opencode.ai/config.json', model, small_model: model, enabled_providers: [provider],
      provider: { [provider]: { npm: '@ai-sdk/openai-compatible', name: 'Phase 0 local router', options: { baseURL: router + '/v1' },
        models: { [modelId]: { name: modelId, limit: { context: 131072, output: 16384 } } } } },
      permission: { external_directory: 'deny' },
      agent: { general: { model }, explore: { model }, 'phase0-no-subagents': { mode: 'primary', model, description: 'Blocked-state validation with task disabled', tools: { task: false } } },
    };
    const env = { ...process.env, OPENCODE_CONFIG_CONTENT: JSON.stringify(baseLocalConfig), OPENCODE_DISABLE_AUTOUPDATE: 'true', OPENCODE_DISABLE_CLAUDE_CODE: 'true' };
    const setup = (name: string) => {
      const cwd = join(scratch, name); mkdirSync(cwd, { recursive: true });
      for (const dir of ['_bmad', '.agents']) cpSync(join(root, dir), join(cwd, dir), { recursive: true,
        filter: source => !['render', 'config.user.toml'].includes(basename(source)) && !source.endsWith('.user.toml') });
      // bmad-loop's opencode-http adapter intentionally uses the Claude-style
      // skill tree as its hermetic transport surface.
      mkdirSync(join(cwd, '.claude'), { recursive: true });
      cpSync(join(cwd, '.agents/skills'), join(cwd, '.claude/skills'), { recursive: true });
      const scratchConfig = {
        ...baseLocalConfig,
        skills: { paths: [join(cwd, '.agents/skills')] },
      };
      writeFileSync(join(cwd, 'opencode.json'), JSON.stringify(scratchConfig, null, 2));
      // A combined BMM+GDS install contains duplicate shorthand keys. The pilot
      // exercises BMM, so give its renderer an intentionally minimal central config.
      writeFileSync(join(cwd, '_bmad/config.toml'), `[core]\nproject_name = "mic-phase0-pilot"\ndocument_output_language = "English"\noutput_folder = "{project-root}/_bmad-output"\n\n[modules.bmm]\nplanning_artifacts = "{project-root}/_bmad-output/planning-artifacts"\nimplementation_artifacts = "{project-root}/_bmad-output/implementation-artifacts"\nproject_knowledge = "{project-root}/docs"\n`);
      writeFileSync(join(cwd, '.gitignore'), '_bmad/render/\n_bmad/config.user.toml\n.bmad-loop/runs/\n.bmad-loop/cache/\nnode_modules/\n');
      writeFileSync(join(cwd, 'package.json'), '{"name":"mic-phase0-pilot","private":true,"type":"module","scripts":{"test":"node --test"}}\n');
      writeFileSync(join(cwd, 'README.md'), '# MIC Phase 0 arithmetic pilot\nNative JavaScript ES modules. No third-party dependencies.\n');
      git(cwd, 'init', '-b', `phase0/${name}`); git(cwd, 'config', 'user.name', 'MIC Phase 0'); git(cwd, 'config', 'user.email', 'phase0@localhost');
      git(cwd, 'add', '.'); git(cwd, 'commit', '-m', 'Seed isolated Phase 0 pilot'); return cwd;
    };
    const scenarios: { result: CommandResult; contracts: { path: string; status: string; blockingCondition?: string; hasResult: boolean }[]; changed: ReturnType<typeof inventory> }[] = [];
    const execute = async (name: string, cwd: string, prompt: string, agent?: string) => {
      console.log(`RUN ${name} (timeout ${options.timeoutMs / 1000}s)`);
      const before = inventory(cwd), baseline = git(cwd, 'rev-parse', 'HEAD');
      const scratchConfig = {
        ...baseLocalConfig,
        skills: { paths: [join(cwd, '.agents/skills')] },
      };
      const scratchEnv = {
        ...env,
        OPENCODE_CONFIG_CONTENT: JSON.stringify(scratchConfig),
        OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true',
      };
      const result = await run(name, ['opencode', 'run', '--dir', cwd, '--pure', '--format', 'json', '--model', model, '--auto', ...(agent ? ['--agent', agent] : []), prompt], cwd, options.timeoutMs, scratchEnv);
      const after = inventory(cwd), changed = changedArtifacts(before, after);
      capture(cwd, join(output, name, 'artifacts'), changed);
      json(join(output, name, 'inventory.json'), { before, after, changed, deleted: before.filter(a => !after.some(b => b.path === a.path)), baselineRevision: baseline, resultRevision: git(cwd, 'rev-parse', 'HEAD'), gitStatus: git(cwd, 'status', '--porcelain') });
      writeFileSync(join(output, name, 'changes.patch'), git(cwd, 'diff', baseline));
      const contracts = changed.filter(a => a.path.endsWith('.md')).flatMap(a => { const c = markdownContract(readFileSync(join(cwd, a.path), 'utf8')); return c ? [{ path: a.path, ...c }] : []; });
      json(join(output, name, 'observed-contracts.json'), contracts); json(join(output, name, 'telemetry.json'), events(result.stdout));
      const scenario = { result, changed, contracts }; scenarios.push(scenario); return scenario;
    };
    const memBefore = sampleResources();
    try {
      const inference = await request('/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: 'Reply with the word ready.' }], max_tokens: 8, temperature: 0 }) }, Math.min(options.timeoutMs, 120000));
      json(join(output, 'model-inference.json'), inference);
      check('model-inference', inference.status === 200 && Array.isArray(inference.body.choices), `${inference.status}, ${inference.durationMs.toFixed(0)} ms (includes cold load); timings=${JSON.stringify(inference.body.timings ?? null)}`, 'model-inference.json');
      const timings = inference.body.timings ?? {};
      check('model-inference-profile', true, `complete request ${inference.durationMs.toFixed(0)} ms; prompt ${timings.prompt_per_second ?? 'unknown'} tokens/s; generation ${timings.predicted_per_second ?? 'unknown'} tokens/s; time to first token unavailable from non-streaming response`, 'model-inference.json');
    } catch (error) { check('model-inference', false, String(error)); }
    json(join(output, 'inference-resource-boundaries.json'), summarizeResources([memBefore, sampleResources()]));
    if (!checks.some(c => c.name === 'model-inference' && c.status === 'pass')) {
      for (const name of ['planning', 'supervised-build', 'unattended-build', 'subagents', 'blocked', 'blocked-recovery', 'bmad-loop', 'resource-profile']) skip(name, 'Selected local model failed inference');
      return reports();
    }
    const cwd = setup('direct');
    const planning = await execute('planning', cwd, 'Use bmad-spec in headless mode. Slug: arithmetic-pilot. Intent: a dependency-free JavaScript ES module arithmetic.js exporting add(a,b), subtract(a,b), multiply(a,b), and divide(a,b) for finite numbers. divide throws RangeError for zero divisor. Tests use node:test. Non-goals: CLI, UI, persistence, arbitrary precision. Return generated artifact paths. Planning only; do not implement.');
    const specFiles = planning.changed.filter(a => /\/SPEC\.md$/.test(a.path));
    const planningPassed = commandPass(planning.result) && specFiles.length === 1 && planning.changed.some(a => a.path.endsWith('/.memlog.md'));
    check('planning', planningPassed,
      `SPEC paths: ${specFiles.map(a => a.path).join(', ') || 'none'}; exit ${planning.result.exitCode}; timedOut ${planning.result.timedOut}; duration ${(planning.result.durationMs / 1000).toFixed(1)} s`,
      'planning/inventory.json');
    if (!planningPassed) {
      for (const name of ['supervised-planning', 'supervised-build', 'unattended-build', 'subagents', 'blocked', 'blocked-recovery', 'loop-preflight', 'bmad-loop'])
        skip(name, 'Planning prerequisite failed; Phase 0 stops before dependent execution');
      check('resource-profile', resourcesPass(planning.result.resources),
        `Planning run: ${JSON.stringify(planning.result.resources)}`, 'planning/command.json');
      return reports();
    }
    git(cwd, 'add', '.'); git(cwd, 'commit', '--allow-empty', '-m', 'Capture planning result');
    const supervised = await execute('supervised-plan', cwd, 'Use bmad-build-auto to implement this approved intent: export add(a,b) from arithmetic.js using JavaScript addition on finite numbers. Add node:test coverage for positive, negative and zero operands. No dependencies. Halt after planning.');
    const readySpec = supervised.contracts.find(c => c.status === 'ready-for-dev');
    check('supervised-planning', commandPass(supervised.result) && !!readySpec, readySpec?.path ?? 'No ready-for-dev artifact', 'supervised-plan/observed-contracts.json');
    if (readySpec) {
      git(cwd, 'add', '.'); git(cwd, 'commit', '--allow-empty', '-m', 'Approve bounded arithmetic pilot spec');
      const built = await execute('supervised-build', cwd, `Use bmad-build-auto on ${readySpec.path}. The bounded arithmetic pilot is approved. Follow the complete workflow.`);
      const verify = await run('supervised-verify', [process.execPath, '--input-type=module', '-e', "import assert from 'node:assert/strict'; import {add} from './arithmetic.js'; assert.equal(add(2,3),5); assert.equal(add(-3,2),-1); assert.equal(add(0,0),0);"], cwd);
      const tests = await run('supervised-tests', [process.execPath, '--test'], cwd);
      check('supervised-build', commandPass(built.result) && built.contracts.some(c => c.status === 'done' && c.hasResult) && commandPass(verify) && commandPass(tests), 'Requires durable done status, independent assertions and project tests', 'supervised-build/observed-contracts.json');
    } else skip('supervised-build', 'Planning did not reach ready-for-dev');
    const unattendedCwd = setup('unattended');
    const unattended = await execute('unattended-build', unattendedCwd, 'Use bmad-build-auto for this approved pilot: create arithmetic.js exporting subtract(a,b) for finite numbers, with node:test tests for positive, negative and zero values. ES modules, no dependencies, no UI. Execute the full unattended workflow including verification and review.');
    const verify = await run('unattended-verify', [process.execPath, '--input-type=module', '-e', "import assert from 'node:assert/strict'; import {subtract} from './arithmetic.js'; assert.equal(subtract(5,3),2); assert.equal(subtract(-3,2),-5); assert.equal(subtract(0,0),0);"], unattendedCwd);
    const tests = await run('unattended-tests', [process.execPath, '--test'], unattendedCwd);
    check('unattended-build', commandPass(unattended.result) && unattended.contracts.some(c => c.status === 'done' && c.hasResult) && commandPass(verify) && commandPass(tests), 'Requires durable done status, independent assertions and project tests', 'unattended-build/observed-contracts.json');
    check('subagents', scenarios.some(s => hasCompletedSubagent(s.result.stdout)), 'Require completed task tool calls, not just agent listing', 'unattended-build/telemetry.json');
    const blockedCwd = setup('blocked');
    const blocked = await execute('blocked', blockedCwd, 'Use bmad-build-auto to create arithmetic.js exporting add(a,b) with node:test tests. Follow the skill including its subagent requirement and HALT protocol.', 'phase0-no-subagents');
    check('blocked', commandPass(blocked.result) && blocked.contracts.some(c => c.status === 'blocked' && /no subagents/i.test(c.blockingCondition ?? '')), 'task disabled; require persisted blocked / no subagents payload', 'blocked/observed-contracts.json');
    const blockedSpec = blocked.contracts.find(c => c.status === 'blocked');
    if (blockedSpec) {
      git(blockedCwd, 'add', '.'); git(blockedCwd, 'commit', '--allow-empty', '-m', 'Preserve blocked evidence');
      const recovery = await execute('blocked-recovery', blockedCwd, `Use bmad-build-auto on ${blockedSpec.path}. Subagents are now available. Follow the documented handling of this blocked artifact; do not fabricate success.`);
      check('blocked-recovery', commandPass(recovery.result) && recovery.contracts.some(c => ['blocked', 'done'].includes(c.status) && c.hasResult), 'Observe remediation required before re-dispatch', 'blocked-recovery/observed-contracts.json');
    } else skip('blocked-recovery', 'No blocked artifact to recover');
    // Explicit synthetic pilot input, never presented as BMAD output.
    const loopCwd = setup('loop'); mkdirSync(join(loopCwd, 'pilot-spec'), { recursive: true });
    writeFileSync(join(loopCwd, 'pilot-spec/SPEC.md'), '# Arithmetic pilot\n\n## Why\nValidate two ordered stories.\n\n## Capabilities\nMultiply and divide finite numbers; divide throws RangeError on zero divisor.\n\n## Constraints\nJavaScript ES modules, arithmetic.js exports multiply and divide, node:test tests, no dependencies.\n\n## Non-goals\nCLI, UI, arbitrary precision.\n\n## Success signal\nIndependent assertions and tests pass.\n');
    writeFileSync(join(loopCwd, 'pilot-spec/stories.yaml'), '- id: "1"\n  title: Multiply finite numbers\n  description: Export multiply(a,b) from arithmetic.js and test positive, negative and zero cases.\n- id: "2"\n  title: Divide finite numbers\n  description: Add divide(a,b) to arithmetic.js; throw RangeError for zero divisor, with node:test coverage. Preserve multiply.\n');
    const init = await run('loop-init', ['bmad-loop', 'init', '--project', loopCwd, '--cli', 'opencode'], loopCwd);
    if (commandPass(init)) {
      const policyPath = join(loopCwd, '.bmad-loop/policy.toml');
      let policy = readFileSync(policyPath, 'utf8');
      policy = policy.replace(/\[adapter\]([\s\S]*?)(?=\n\[|$)/, (_all, section: string) => '[adapter]\n' + section.replace(/^name\s*=.*$/m, 'name = "opencode-http"').replace(/^model\s*=.*$/m, '').trim() + `\nmodel = ${JSON.stringify(model)}\n`);
      policy = policy.replace(/^mode = "per-epic"/m, 'mode = "none"').replace(/^session_timeout_min = \d+/m, `session_timeout_min = ${Math.max(1, Math.floor(options.timeoutMs / 60000))}`).replace(/^desktop = true/m, 'desktop = false');
      writeFileSync(policyPath, policy); git(loopCwd, 'add', '.'); git(loopCwd, 'commit', '-m', 'Approve two-story throwaway pilot');
      capture(loopCwd, join(output, 'loop-input'), inventory(loopCwd).filter(a => a.path.startsWith('pilot-spec/') || a.path === '.bmad-loop/policy.toml'));
      const preflight = await run('loop-preflight', ['bmad-loop', 'validate', '--project', loopCwd, '--spec', 'pilot-spec', '--json'], loopCwd);
      check('loop-preflight', commandPass(preflight), 'Preflight, distinct from epic execution', 'loop-preflight/stdout.log');
      if (commandPass(preflight)) {
        const before = inventory(loopCwd);
        const loop = await run('bmad-loop', ['bmad-loop', 'run', '--project', loopCwd, '--spec', 'pilot-spec', '--max-stories', '2'], loopCwd, options.timeoutMs * 2, env);
        if (loop.timedOut) {
          const runsDir = join(loopCwd, '.bmad-loop/runs');
          for (const id of existsSync(runsDir) ? readdirSync(runsDir) : []) {
            if (/^[A-Za-z0-9_-]+$/.test(id)) await run(`loop-stop-${id}`, ['bmad-loop', 'stop', '--project', loopCwd, id], loopCwd, 30000);
          }
        }
        const after = inventory(loopCwd), changed = changedArtifacts(before, after);
        capture(loopCwd, join(output, 'bmad-loop/artifacts'), changed); json(join(output, 'bmad-loop/inventory.json'), { before, after, changed });
        const results = changed.filter(a => /(^|\/)result\.json$/.test(a.path));
        const done = changed.filter(a => /^pilot-spec\/stories\/.*\.md$/.test(a.path) && markdownContract(readFileSync(join(loopCwd, a.path), 'utf8'))?.status === 'done');
        const loopVerify = await run('loop-verify', [process.execPath, '--input-type=module', '-e', "import assert from 'node:assert/strict'; import {multiply,divide} from './arithmetic.js'; assert.equal(multiply(3,-2),-6); assert.equal(multiply(4,0),0); assert.equal(divide(6,2),3); assert.throws(()=>divide(3,0),RangeError);"], loopCwd);
        const loopTests = await run('loop-tests', [process.execPath, '--test'], loopCwd);
        check('bmad-loop', commandPass(loop) && results.length > 0 && done.length === 2 && commandPass(loopVerify) && commandPass(loopTests), `${done.length}/2 done; ${results.length} result.json files; exit ${loop.exitCode}`, 'bmad-loop/inventory.json');
        check('loop-resource-profile', resourcesPass(loop.resources), JSON.stringify(loop.resources), 'bmad-loop/command.json');
      } else skip('bmad-loop', 'Preflight failed');
    } else { check('loop-init', false, init.error ?? init.stderr, 'loop-init/command.json'); skip('bmad-loop', 'Init failed'); }
    check('resource-profile', scenarios.length > 0 && scenarios.every(s => resourcesPass(s.result.resources)), 'Every scenario: >200 MiB available, <75% unified-memory bound, GPU measured, zero swap/OOM deltas', 'unattended-build/resources.jsonl');
    return reports();
  } catch (error) { check('validator-error', false, String(error)); return reports(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (key: string) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
  if (args.includes('--help')) console.log('Usage: npm run phase0 -- [--live] [--model provider/model] [--timeout-ms 900000] [--root path] [--router http://127.0.0.1:10000]');
  else {
    const timeoutMs = Number(value('--timeout-ms') ?? 900000);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error('timeout-ms must be >=1000');
    validate({ root: value('--root') ?? process.cwd(), live: args.includes('--live'), timeoutMs, model: value('--model'), router: value('--router') })
      .then(passed => { process.exitCode = passed ? 0 : 1; }).catch(error => { console.error(error); process.exitCode = 1; });
  }
}
