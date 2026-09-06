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
    if (info.isDirectory()) result.push(...await files(root, path));
    else result.push(relative(root, path));
  }
  return result.sort();
}

async function snapshot(root: string) {
  const paths = await files(root);
  return new Map(await Promise.all(paths.map(async path => [path, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')] as const)));
}

export interface WorkflowRunRequest {
  runId: string;
  skill: string;
  action?: string;
  args?: Record<string, unknown>;
  prompt: string;
  repository: string;
  workspace: string;
  baseline: string;
  model: string;
  timeoutMs?: number;
  providerSessionId?: string;
}

export interface WorkflowRunResult extends RunResult {
  workflow: { skill: string; action?: string; args: Record<string, unknown> };
}

export function terminalArtifactStatus(contents: string[]) {
  const statuses = contents.map(value => value.match(/^---[\s\S]*?^status:\s*['"]?([\w-]+)/m)?.[1]?.toLowerCase()).filter(Boolean);
  if (statuses.includes('blocked')) return 'blocked' as const;
  if (statuses.some(value => ['done', 'complete', 'completed', 'ready-for-dev'].includes(value!))) return 'done' as const;
  return undefined;
}

export class BmadRunnerAdapter {
  constructor(private readonly harness = new OpenCodeAdapter()) {}

  async execute(input: WorkflowRunRequest): Promise<WorkflowRunResult> {
    if (!/^bmad-[a-z0-9-]+$/.test(input.skill)) throw new Error(`Invalid BMAD skill: ${input.skill}`);
    const before = await snapshot(input.workspace);
    const details = [input.action ? `Action: ${input.action}.` : '', Object.keys(input.args ?? {}).length ? `Arguments: ${JSON.stringify(input.args)}.` : '', input.prompt].filter(Boolean).join('\n');
    this.harness.dispatch({ runId: input.runId, cwd: input.workspace, model: input.model, command: input.providerSessionId ? undefined : input.skill, sessionId: input.providerSessionId, timeoutMs: input.timeoutMs, prompt: details });
    const observed = await this.harness.observe(input.runId, true);
    const after = await snapshot(input.workspace);
    const artifactRefs = [...after].filter(([path, hash]) => before.get(path) !== hash).map(([path]) => path);
    const textArtifacts = await Promise.all(artifactRefs.filter(path => /\.(md|ya?ml|json|txt)$/i.test(path)).map(path => readFile(resolve(input.workspace, path), 'utf8').catch(() => '')));
    const artifactStatus = terminalArtifactStatus(textArtifacts);
    const status = observed.status === 'cancelled' ? 'cancelled' : artifactStatus ?? (observed.exitCode === 0 ? 'done' : 'failed');
    const resultRevision = (await exec('git', ['-C', input.workspace, 'rev-parse', 'HEAD'])).stdout.trim();
    return {
      runId: input.runId, status, artifactRefs,
      evidenceRefs: artifactRefs.filter(path => /(?:test|evidence|result|report|log)/i.test(path)),
      repositoryRevisions: { baseline: input.baseline, result: resultRevision },
      blockingCondition: status === 'blocked' ? { code: 'bmad_blocked', message: textArtifacts.find(value => /blocked/i.test(value))?.slice(0, 2000) ?? observed.stderr } : undefined,
      summary: `${input.skill}${input.action ? `:${input.action}` : ''} ${status}; ${artifactRefs.length} changed artifact(s)`,
      rawAdapterState: { ...observed, repository: input.repository, worktree: input.workspace, stdoutSha256: createHash('sha256').update(observed.stdout).digest('hex') },
      workflow: { skill: input.skill, action: input.action, args: input.args ?? {} },
    };
  }

  cancel(runId: string) { return this.harness.cancel(runId); }
  recover(runId: string, cwd?: string) { return this.harness.recover(runId, cwd); }
}
