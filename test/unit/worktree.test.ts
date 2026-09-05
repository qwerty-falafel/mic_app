import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WorktreeManager, type WorktreeLease } from '../../src/worktree.js';

const exec = promisify(execFile);
describe('WorktreeManager', () => {
  let root = '', lease: WorktreeLease | undefined;
  afterEach(async () => { if (lease) await new WorktreeManager(resolve(root, 'worktrees')).remove(lease); if (root) await rm(root, { recursive: true, force: true }); });

  it('creates an isolated branch at an immutable baseline and removes it', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'mic-worktree-'));
    const repository = resolve(root, 'repository');
    await exec('git', ['init', repository]);
    await exec('git', ['-C', repository, 'config', 'user.email', 'mic@test.invalid']);
    await exec('git', ['-C', repository, 'config', 'user.name', 'MIC test']);
    await writeFile(resolve(repository, 'README.md'), 'baseline\n');
    await exec('git', ['-C', repository, 'add', '.']);
    await exec('git', ['-C', repository, 'commit', '-m', 'baseline']);
    const baseline = (await exec('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
    const manager = new WorktreeManager(resolve(root, 'worktrees'));
    lease = await manager.create(repository, baseline, 'wi 1', 'run 1');
    expect(lease.baseline).toBe(baseline);
    expect((await exec('git', ['-C', lease.path, 'branch', '--show-current'])).stdout.trim()).toBe('mic/wi-1/run-1');
    await writeFile(resolve(lease.path, 'README.md'), 'changed\n');
    expect(await (await import('node:fs/promises')).readFile(resolve(repository, 'README.md'), 'utf8')).toBe('baseline\n');
    await manager.remove(lease); lease = undefined;
    await expect((await import('node:fs/promises')).stat(resolve(root, 'worktrees', 'wi-1', 'run-1'))).rejects.toThrow();
  });
});
