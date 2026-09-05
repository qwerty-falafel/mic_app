import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventory, changedArtifacts, capture, markdownContract, hasCompletedSubagent } from '../../scripts/phase0/artifacts.js';
import { counters, resourcesPass, summarizeResources, type ResourceSample } from '../../scripts/phase0/resources.js';
import { command, commandPass } from '../../scripts/phase0/process.js';
import { validationPass } from '../../scripts/phase0-validate.js';
const dirs: string[] = [];
function temp() { const d = mkdtempSync(join(tmpdir(), 'mic-validator-')); dirs.push(d); return d; }
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe('evidence integrity', () => {
  it('captures changed and hidden files without following symlinks or calling unchanged seeds output', () => {
    const root = temp(), output = temp(), outside = temp();
    writeFileSync(join(root, 'seed.md'), 'unchanged');
    writeFileSync(join(outside, 'secret'), 'not an artifact');
    const before = inventory(root);
    mkdirSync(join(root, 'spec')); writeFileSync(join(root, 'spec/.memlog.md'), 'decision');
    symlinkSync(outside, join(root, 'outside'));
    const changed = changedArtifacts(before, inventory(root));
    expect(changed.map(a => a.path)).toEqual(['spec/.memlog.md']);
    expect(changed[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    capture(root, output, changed);
    expect(readFileSync(join(output, 'spec/.memlog.md'), 'utf8')).toBe('decision');
    expect(existsSync(join(output, 'outside'))).toBe(false);
  });
  it('parses the installed Markdown HALT shape', () => {
    expect(markdownContract('---\nstatus: blocked\n---\n# BMad Build Auto Result\n\n## Auto Run Result\n\nStatus: blocked\nBlocking condition: no subagents\n')).toEqual({ status: 'blocked', hasResult: true, blockingCondition: 'no subagents' });
    expect(markdownContract('---\nstatus: done\n---\n## Auto Run Result\nStatus: done\n')).toMatchObject({ status: 'done', hasResult: true });
    expect(markdownContract('---\nstatus: done\n---\nDone!')).toMatchObject({ hasResult: false });
    expect(markdownContract('done')).toBeNull();
    expect(markdownContract('---\nstatus: [broken\n---\n')).toBeNull();
  });
  it('does not confuse a claimed subagent with an observed completed task', () => {
    expect(hasCompletedSubagent('I ran a subagent')).toBe(false);
    expect(hasCompletedSubagent(JSON.stringify({ type: 'text', part: { text: 'task completed' } }))).toBe(false);
    expect(hasCompletedSubagent(JSON.stringify({ type: 'tool_use', part: { tool: 'task', state: { status: 'running' } } }))).toBe(false);
    expect(hasCompletedSubagent(JSON.stringify({ type: 'tool_use', part: { tool: 'task', state: { status: 'completed' } } }))).toBe(true);
  });
  it('never promotes failure, missing checks, or discovery-only to success', () => {
    expect(validationPass([])).toBe(false);
    expect(validationPass([{ name: 'build', status: 'not-run', detail: 'missing' }])).toBe(false);
    expect(validationPass([{ name: 'build', status: 'fail', detail: 'failed' }])).toBe(false);
    expect(validationPass([{ name: 'build', status: 'pass', detail: 'captured' }])).toBe(true);
  });
});

describe('bounded subprocesses', () => {
  it('captures exact command, output and nonzero exit', async () => {
    const dir = temp();
    const result = await command([process.execPath, '-e', 'console.log("out"); console.error("err"); process.exit(7)'], dir, join(dir, 'evidence'));
    expect(result.exitCode).toBe(7); expect(commandPass(result)).toBe(false);
    expect(readFileSync(join(dir, 'evidence/stdout.log'), 'utf8')).toContain('out');
    expect(readFileSync(join(dir, 'evidence/stderr.log'), 'utf8')).toContain('err');
    expect(JSON.parse(readFileSync(join(dir, 'evidence/command.json'), 'utf8')).exitCode).toBe(7);
  });
  it('reports a missing executable as failure', async () => {
    const dir = temp(); const result = await command(['mic-does-not-exist'], dir, join(dir, 'evidence'));
    expect(result.error).toContain('ENOENT'); expect(commandPass(result)).toBe(false);
  });
  it('terminates a hanging command at its deadline', async () => {
    const dir = temp(); const result = await command([process.execPath, '-e', 'setInterval(()=>{},100)'], dir, join(dir, 'evidence'), 150);
    expect(result.timedOut).toBe(true); expect(result.durationMs).toBeLessThan(5000); expect(commandPass(result)).toBe(false);
  });
  it('does not interpolate shell metacharacters', async () => {
    const dir = temp(); const input = '$(touch SHOULD_NOT_EXIST); `echo bad`';
    const result = await command([process.execPath, '-e', 'console.log(process.argv[1])', input], dir, join(dir, 'evidence'));
    expect(commandPass(result)).toBe(true); expect(result.stdout.trim()).toBe(input); expect(existsSync(join(dir, 'SHOULD_NOT_EXIST'))).toBe(false);
  });
});

const sample: ResourceSample = { at: 'now', totalMiB: 1000, availableMiB: 400, swapIn: 1, swapOut: 2, oomKills: 0, cpuTotal: 1000, cpuIdle: 500, models: [{ pid: 1, rssMiB: 100, gpuResidentMiB: 300 }] };
describe('resource acceptance', () => {
  it('reads colon-bearing meminfo and colon-free vmstat', () => {
    expect(counters('MemAvailable:   400 kB\npswpin 17\ndrm-resident-gtt:\t300 KiB')).toEqual({ MemAvailable: 400, pswpin: 17, 'drm-resident-gtt': 300 });
  });
  it('allows healthy measurements with no new swap or OOM', () => {
    const summary = summarizeResources([sample, { ...sample, cpuTotal: 1100, cpuIdle: 520 }]);
    expect(resourcesPass(summary)).toBe(true); expect(summary?.peakSystemCpuPercent).toBe(80);
  });
  it.each([
    { availableMiB: 200 }, { swapIn: 2 }, { swapOut: 3 }, { oomKills: 1 },
    { models: [{ pid: 1, rssMiB: 100, gpuResidentMiB: 650 }] },
  ])('rejects resource breach %j', change => { expect(resourcesPass(summarizeResources([sample, { ...sample, ...change }]))).toBe(false); });
  it('rejects missing measurements', () => {
    expect(resourcesPass(null)).toBe(false);
    expect(resourcesPass(summarizeResources([sample]))).toBe(false);
    expect(resourcesPass(summarizeResources([{ ...sample, models: [] }, { ...sample, models: [] }]))).toBe(false);
  });
});
