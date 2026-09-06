export type RunStatus = 'queued' | 'running' | 'done' | 'blocked' | 'failed' | 'cancelled';

export interface BlockingCondition {
  code: string;
  message: string;
  remediation?: string;
  raw?: unknown;
}

export interface RunResult {
  runId: string;
  status: RunStatus;
  artifactRefs: string[];
  evidenceRefs: string[];
  repositoryRevisions: { baseline: string; result: string };
  blockingCondition?: BlockingCondition;
  summary: string;
  rawAdapterState: Record<string, unknown>;
}

export interface ExecutionRequest {
  runId: string;
  cwd: string;
  model: string;
  command?: string;
  sessionId?: string;
  prompt: string;
  timeoutMs?: number;
}
