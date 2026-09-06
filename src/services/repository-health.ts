import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const exec = promisify(execFile);

export async function repositoryHealth(path: string, baseBranch?: string) {
  path = resolve(path);
  try {
    const [root, branch, revision, status, base] = await Promise.all([
      exec('git', ['-C', path, 'rev-parse', '--show-toplevel']),
      exec('git', ['-C', path, 'branch', '--show-current']),
      exec('git', ['-C', path, 'rev-parse', 'HEAD']),
      exec('git', ['-C', path, 'status', '--porcelain=v1']),
      baseBranch ? exec('git', ['-C', path, 'rev-parse', '--verify', `${baseBranch}^{commit}`]).catch(() => null) : Promise.resolve(null),
    ]);
    const dirty = status.stdout.split(/\r?\n/).filter(Boolean);
    return { valid: root.stdout.trim() === path, requestedPath: path, root: root.stdout.trim(), branch: branch.stdout.trim(), revision: revision.stdout.trim(), baseBranch, baseExists: baseBranch ? !!base : undefined, clean: dirty.length === 0, changes: dirty };
  } catch (error) { return { valid: false, requestedPath: path, clean: false, error: String(error), changes: [] as string[] }; }
}
