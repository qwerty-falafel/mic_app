import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, cp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { repositories, runs, workItems } from '../db/schema.js';
import { BmadDirectAdapter } from '../adapters/bmad-direct.js';
import type { RunResult } from '../types.js';
import { WorktreeManager, type WorktreeLease } from '../worktree.js';
import type { LifecycleExecutor } from './lifecycle.js';

const exec = promisify(execFile);
const sharedBmadRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../_bmad');

async function prepareBmadRuntime(worktree: string, repository: string) {
  const runtime = resolve(worktree, '_bmad');
  try {
    await access(runtime);
    return async () => {};
  } catch {}
  await cp(sharedBmadRoot, runtime, { recursive: true });
  await writeFile(resolve(runtime, 'config.user.toml'), `[core]\nproject_name = ${JSON.stringify(basename(repository))}\n`);
  return () => rm(runtime, { recursive: true, force: true });
}

export class ProjectExecutionService implements LifecycleExecutor {
  constructor(private readonly db: Database, private readonly model: string, private readonly worktrees = new WorktreeManager(), private readonly adapter = new BmadDirectAdapter()) {}

  async execute(input: { mode: 'planning' | 'implementation'; runId: string; workItemId: string; intent: string }) {
    const [item] = await this.db.select().from(workItems).where(eq(workItems.id, input.workItemId));
    if (!item) throw new Error('Work item not found');
    let lease: WorktreeLease;
    if (input.mode === 'implementation') {
      const prior = await this.db.select().from(runs).where(and(eq(runs.workItemId, input.workItemId), eq(runs.kind, 'planning'), eq(runs.status, 'DONE'))).orderBy(desc(runs.createdAt)).limit(1);
      const raw = (prior[0]?.result as RunResult | null)?.rawAdapterState as any;
      if (!raw?.worktree || !raw?.repository || !raw?.branch) throw new Error('Approved planning worktree is unavailable');
      lease = { path: raw.worktree, repository: raw.repository, branch: raw.branch, baseline: raw.baseline };
    } else {
      const [repository] = await this.db.select().from(repositories).where(eq(repositories.projectId, item.projectId)).limit(1);
      if (!repository) throw new Error('Project has no repository');
      const prior = await this.db.select().from(runs).where(and(eq(runs.workItemId, input.workItemId), eq(runs.kind, 'planning'), eq(runs.status, 'DONE'))).orderBy(desc(runs.createdAt)).limit(1);
      const raw = (prior[0]?.result as RunResult | null)?.rawAdapterState as any;
      lease = raw?.worktree && raw?.repository && raw?.branch && existsSync(raw.worktree)
        ? { path: raw.worktree, repository: raw.repository, branch: raw.branch, baseline: raw.baseline }
        : await this.worktrees.create(repository.path, repository.baseBranch, input.workItemId, input.runId);
    }
    const cleanupBmad = await prepareBmadRuntime(lease.path, lease.repository);
    let result: RunResult;
    try { result = await this.adapter.execute({ ...input, worktree: lease.path, baseline: lease.baseline, model: this.model }); }
    finally { await cleanupBmad(); }
    if (result.status === 'done') {
      await exec('git', ['-C', lease.path, 'add', '-A']);
      const status = (await exec('git', ['-C', lease.path, 'status', '--porcelain'])).stdout;
      if (status.trim()) await exec('git', ['-C', lease.path, '-c', 'user.name=MIC', '-c', 'user.email=mic@localhost', 'commit', '-m', `MIC ${input.mode} ${input.workItemId}`]);
      result.repositoryRevisions.result = (await exec('git', ['-C', lease.path, 'rev-parse', 'HEAD'])).stdout.trim();
    }
    Object.assign(result.rawAdapterState, { worktree: lease.path, repository: lease.repository, branch: lease.branch, baseline: lease.baseline });
    return result;
  }

  async finalize(_workItemId: string, result: RunResult) {
    const raw = result.rawAdapterState as any;
    if (!raw.repository || !raw.worktree || !raw.branch) throw new Error('Run result has no worktree provenance');
    await exec('git', ['-C', raw.repository, 'merge', '--ff-only', result.repositoryRevisions.result]);
    await this.worktrees.remove({ repository: raw.repository, path: raw.worktree, branch: raw.branch, baseline: raw.baseline });
  }
  cancel(runId: string) { return this.adapter.cancel(runId); }
}
