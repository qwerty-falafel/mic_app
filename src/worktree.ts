import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export interface WorktreeLease { path: string; branch: string; baseline: string; repository: string }

export class WorktreeManager {
  constructor(private readonly root = resolve('.runtime/worktrees')) {}

  async create(repository: string, baseline: string, workItemId: string, runId: string): Promise<WorktreeLease> {
    repository = resolve(repository);
    const branch = `mic/${safe(workItemId)}/${safe(runId)}`;
    const path = resolve(this.root, safe(workItemId), safe(runId));
    await mkdir(resolve(path, '..'), { recursive: true });
    await exec('git', ['-C', repository, 'rev-parse', '--verify', `${baseline}^{commit}`]);
    const { stdout } = await exec('git', ['-C', repository, 'rev-parse', baseline]);
    await exec('git', ['-C', repository, 'worktree', 'add', '-b', branch, path, stdout.trim()]);
    return { path, branch, baseline: stdout.trim(), repository };
  }

  async remove(lease: WorktreeLease) {
    await exec('git', ['-C', lease.repository, 'worktree', 'remove', '--force', lease.path]).catch(() => undefined);
    await rm(lease.path, { recursive: true, force: true });
    await exec('git', ['-C', lease.repository, 'branch', '-D', lease.branch]).catch(() => undefined);
    await exec('git', ['-C', lease.repository, 'worktree', 'prune']);
  }
}
