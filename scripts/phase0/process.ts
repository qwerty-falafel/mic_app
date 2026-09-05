import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sampleResources, summarizeResources, type ResourceSample } from './resources.js';

export interface CommandResult {
  argv: string[]; cwd: string; exitCode: number | null; signal: string | null;
  timedOut: boolean; error?: string; durationMs: number; stdout: string; stderr: string;
  resources: ReturnType<typeof summarizeResources>;
}

export async function command(argv: string[], cwd: string, output: string, timeoutMs = 15_000,
  env: NodeJS.ProcessEnv = process.env): Promise<CommandResult> {
  mkdirSync(output, { recursive: true });
  const stdoutFile = createWriteStream(resolve(output, 'stdout.log'));
  const stderrFile = createWriteStream(resolve(output, 'stderr.log'));
  const resourceFile = createWriteStream(resolve(output, 'resources.jsonl'));
  const samples: ResourceSample[] = [];
  const start = performance.now();
  let stdout = '', stderr = '', error: string | undefined, timedOut = false;
  const sample = () => {
    try { const s = sampleResources(); samples.push(s); resourceFile.write(JSON.stringify(s) + '\n'); }
    catch (e) { error ??= `Resource monitor: ${String(e)}`; }
  };
  sample();
  const timer = setInterval(sample, 1000);
  const child = spawn(argv[0], argv.slice(1), { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const kill = (signal: NodeJS.Signals) => { if (child.pid) { try { process.kill(-child.pid, signal); } catch { /* Already exited. */ } } };
  let escalation: NodeJS.Timeout | undefined;
  const timeout = setTimeout(() => { timedOut = true; kill('SIGTERM'); escalation = setTimeout(() => kill('SIGKILL'), 3000); }, timeoutMs);
  const interrupt = () => { error = 'Validation interrupted'; kill('SIGTERM'); escalation ??= setTimeout(() => kill('SIGKILL'), 3000); };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  child.stdout.on('data', data => { stdoutFile.write(data); stdout = (stdout + data).slice(-2_000_000); });
  child.stderr.on('data', data => { stderrFile.write(data); stderr = (stderr + data).slice(-200_000); });
  child.on('error', e => { error = e.message; });
  const ended = await new Promise<{ exitCode: number | null; signal: string | null }>(done => child.on('close', (exitCode, signal) => done({ exitCode, signal })));
  clearTimeout(timeout); clearInterval(timer); if (escalation) { kill('SIGKILL'); clearTimeout(escalation); }
  process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
  sample();
  await Promise.all([stdoutFile, stderrFile, resourceFile].map(stream => new Promise<void>(done => stream.end(done))));
  const result: CommandResult = { argv, cwd, ...ended, timedOut, error, durationMs: performance.now() - start,
    stdout, stderr, resources: summarizeResources(samples) };
  writeFileSync(resolve(output, 'command.json'), JSON.stringify({ ...result, stdout: 'stdout.log', stderr: 'stderr.log' }, null, 2));
  return result;
}

export function commandPass(result: CommandResult): boolean {
  return result.exitCode === 0 && !result.timedOut && !result.error;
}
