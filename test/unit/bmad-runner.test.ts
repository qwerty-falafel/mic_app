import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { BmadRunnerAdapter } from '../../src/adapters/bmad-runner.js';
import { csvRows } from '../../src/services/bmad-catalog.js';

const exec = promisify(execFile);
const cleanup: string[] = [];

afterEach(async () => Promise.all(cleanup.splice(0).map(path => rm(path, { recursive: true, force: true }))));

describe('BMAD catalog and generic runner', () => {
  it('parses quoted catalog metadata without hard-coded skills', () => {
    const rows = csvRows('module,skill,description,action\nBMM,bmad-spec,"Create, update, validate",build-process\nBMM,bmad-help,Guide,\n');
    expect(rows).toEqual([
      { module: 'BMM', skill: 'bmad-spec', description: 'Create, update, validate', action: 'build-process' },
      { module: 'BMM', skill: 'bmad-help', description: 'Guide', action: '' },
    ]);
  });

  it('dispatches different named skills through one runner contract', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'mic-runner-')); cleanup.push(root);
    await exec('git', ['init', '-b', 'main'], { cwd: root });
    await writeFile(resolve(root, 'README.md'), '# fixture\n');
    await exec('git', ['add', '.'], { cwd: root });
    await exec('git', ['-c', 'user.name=MIC Test', '-c', 'user.email=test@localhost', 'commit', '-m', 'seed'], { cwd: root });
    const baseline = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
    const commands: string[] = [];
    const harness = {
      dispatch(request: { command?: string }) { commands.push(request.command!); },
      observe: async (runId: string) => ({ runId, status: 'done' as const, exitCode: 0, signal: null, stdout: '', stderr: '', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() }),
      cancel: () => true,
      recover: async () => { throw new Error('unused'); },
    };
    const runner = new BmadRunnerAdapter(harness as any);
    for (const skill of ['bmad-help', 'bmad-spec']) {
      const result = await runner.execute({ runId: skill, skill, prompt: 'fixture', repository: root, workspace: root, baseline, model: 'fixture/model' });
      expect(result.workflow.skill).toBe(skill);
      expect(result.status).toBe('done');
    }
    expect(commands).toEqual(['bmad-help', 'bmad-spec']);
    await expect(runner.execute({ runId: 'bad', skill: '../shell', prompt: 'x', repository: root, workspace: root, baseline, model: 'fixture/model' })).rejects.toThrow('Invalid BMAD skill');
  });
});
