import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExecutionRequest } from '../types.js';

export interface HarnessObservation { runId: string; status: 'running' | 'done' | 'failed' | 'cancelled'; exitCode: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; startedAt: string; finishedAt?: string }

interface ActiveRun { child: ChildProcess; observation: HarnessObservation; completion: Promise<HarnessObservation> }

export class OpenCodeAdapter {
  private readonly runs = new Map<string, ActiveRun>();

  dispatch(request: ExecutionRequest) {
    if (this.runs.has(request.runId)) throw new Error(`Run already exists: ${request.runId}`);
    const args = ['run', '--dir', request.cwd, '--pure', '--format', 'json', '--model', request.model, '--auto', request.prompt];
    const statePath = resolve(request.cwd, '.mic/runs', `${request.runId}.json`);
    mkdirSync(resolve(statePath, '..'), { recursive: true });
    const child = spawn('opencode', args, { cwd: request.cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const observation: HarnessObservation = { runId: request.runId, status: 'running', exitCode: null, signal: null, stdout: '', stderr: '', startedAt: new Date().toISOString() };
    child.stdout?.on('data', chunk => { observation.stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { observation.stderr += chunk.toString(); });
    const completion = new Promise<HarnessObservation>((resolveRun, reject) => {
      let timeout: NodeJS.Timeout | undefined;
      if (request.timeoutMs) timeout = setTimeout(() => child.kill('SIGTERM'), request.timeoutMs);
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (timeout) clearTimeout(timeout);
        observation.exitCode = code; observation.signal = signal; observation.finishedAt = new Date().toISOString();
        observation.status = signal === 'SIGTERM' ? 'cancelled' : code === 0 ? 'done' : 'failed';
        writeFileSync(statePath, JSON.stringify(observation, null, 2) + '\n');
        resolveRun(observation);
      });
    });
    this.runs.set(request.runId, { child, observation, completion });
    return request.runId;
  }

  observe(runId: string, wait = false) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown run: ${runId}`);
    return wait ? run.completion : Promise.resolve({ ...run.observation });
  }

  cancel(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return false;
    return run.child.kill('SIGTERM');
  }

  recover(runId: string, cwd?: string) {
    if (this.runs.has(runId)) return this.observe(runId);
    if (!cwd) throw new Error('cwd is required to recover a run after restart');
    return Promise.resolve(JSON.parse(readFileSync(resolve(cwd, '.mic/runs', `${runId}.json`), 'utf8')) as HarnessObservation);
  }
}
