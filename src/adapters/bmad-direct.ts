import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RunResult } from '../types.js';
import { OpenCodeAdapter } from './opencode.js';

const exec = promisify(execFile);
const ignored = new Set(['.git', '.mic', 'node_modules', '.bmad-loop']);
async function files(root: string, dir = root): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir)) {
    if (ignored.has(entry)) continue;
    const path = resolve(dir, entry), info = await stat(path);
    if (info.isDirectory()) result.push(...await files(root, path)); else result.push(relative(root, path));
  }
  return result.sort();
}

export function deriveBmadStatus(mode: 'planning' | 'implementation', paths: string[], contents: string[], exitCode: number | null) {
  const match = contents.map(value => value.match(/^---[\s\S]*?^status:\s*['"]?([\w-]+)/m)?.[1]).find(Boolean);
  if (match === 'done') return 'done' as const;
  if (match === 'blocked' || contents.some(value => /blocked:\s*(no subagents|true)|status:\s*blocked/i.test(value))) return 'blocked' as const;
  if (mode === 'planning' && exitCode === 0 && paths.some(path => /(?:^|\/)SPEC\.md$/i.test(path))) return 'done' as const;
  return 'failed' as const;
}

export function orderArtifactRefs(mode: 'planning' | 'implementation', paths: string[]) {
  if (mode !== 'planning') return paths;
  return [...paths].sort((left, right) => {
    const rank = (path: string) => /(?:^|\/)SPEC\.md$/i.test(path) ? 0 : /(?:^|\/)\.memlog\.md$/i.test(path) ? 2 : 1;
    return rank(left) - rank(right) || left.localeCompare(right);
  });
}

export class BmadDirectAdapter {
  constructor(private readonly harness = new OpenCodeAdapter()) {}

  async execute(input: { runId: string; worktree: string; baseline: string; model: string; mode: 'planning' | 'implementation'; intent: string; timeoutMs?: number }): Promise<RunResult> {
    const before = new Set(await files(input.worktree));
    const skill = input.mode === 'planning' ? 'bmad-spec' : 'bmad-build-auto';
    this.harness.dispatch({ runId: input.runId, cwd: input.worktree, model: input.model, command: skill, timeoutMs: input.timeoutMs, prompt: input.intent });
    const observed = await this.harness.observe(input.runId, true);
    const after = await files(input.worktree);
    const artifactRefs = orderArtifactRefs(input.mode, after.filter(path => !before.has(path)));
    const textArtifacts = await Promise.all(artifactRefs.filter(path => /\.(md|ya?ml|json|txt)$/i.test(path)).map(path => readFile(resolve(input.worktree, path), 'utf8').catch(() => '')));
    const status = observed.status === 'cancelled' ? 'cancelled' : deriveBmadStatus(input.mode, artifactRefs, textArtifacts, observed.exitCode);
    const resultRevision = (await exec('git', ['-C', input.worktree, 'rev-parse', 'HEAD'])).stdout.trim();
    const evidenceRefs = artifactRefs.filter(path => /(?:test|evidence|result|report|log)/i.test(path));
    const blockingCondition = status === 'blocked' ? { code: 'bmad_blocked', message: textArtifacts.find(value => /blocked/i.test(value))?.slice(0, 2000) ?? observed.stderr, raw: { exitCode: observed.exitCode } } : undefined;
    return { runId: input.runId, status, artifactRefs, evidenceRefs, repositoryRevisions: { baseline: input.baseline, result: resultRevision }, blockingCondition,
      summary: `${skill} ${status}; ${artifactRefs.length} new artifact(s)`, rawAdapterState: { ...observed, stdoutSha256: createHash('sha256').update(observed.stdout).digest('hex') } };
  }

  cancel(runId: string) { return this.harness.cancel(runId); }
  recover(runId: string, cwd?: string) { return this.harness.recover(runId, cwd); }
}
