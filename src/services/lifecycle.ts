import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { approvals, auditEvents, discoveryRecords, implementationArtifacts, outboxEvents, planningArtifacts, questions, runs, technicalRecords, workItems } from '../db/schema.js';
import { Kernel } from '../kernel.js';
import type { RunResult } from '../types.js';

type State = 'INTAKE' | 'PLANNING_GRADE' | 'AWAITING_PLANNING_APPROVAL' | 'TECHNICAL_DISCOVERY' | 'IMPLEMENTATION_GRADE' | 'AWAITING_IMPLEMENTATION_APPROVAL' | 'BLOCKED' | 'DONE';
export interface LifecycleExecutor {
  execute(input: { mode: 'planning' | 'implementation'; runId: string; workItemId: string; intent: string }): Promise<RunResult>;
  finalize?(workItemId: string, result: RunResult): Promise<void>;
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class LifecycleService {
  private readonly kernel: Kernel;
  constructor(private readonly db: Database, private readonly executor: LifecycleExecutor) { this.kernel = new Kernel(db); }

  intake(projectId: string, intent: string, title = intent.slice(0, 120), key: string = randomUUID()) {
    return this.kernel.createWorkItem({ projectId, title, intent, state: 'INTAKE' }, key);
  }

  private async state(workItemId: string) {
    const [item] = await this.db.select().from(workItems).where(eq(workItems.id, workItemId));
    if (!item) throw new Error(`Unknown work item: ${workItemId}`);
    return item;
  }

  private async transition(workItemId: string, from: State, to: State, action: string, detail: Record<string, unknown> = {}) {
    await this.db.transaction(async tx => {
      const changed = await tx.update(workItems).set({ state: to, updatedAt: new Date() }).where(and(eq(workItems.id, workItemId), eq(workItems.state, from))).returning({ id: workItems.id });
      if (changed.length !== 1) throw new Error(`Invalid transition: expected ${from}, requested ${to}`);
      const key = `${workItemId}:${action}:${to}`;
      await tx.insert(auditEvents).values({ aggregateType: 'work_item', aggregateId: workItemId, action, actor: 'lifecycle', detail: { from, to, ...detail }, idempotencyKey: `${key}:audit` });
      await tx.insert(outboxEvents).values({ id: `evt_${randomUUID()}`, topic: `lifecycle.${action}`, payload: { workItemId, from, to, ...detail }, idempotencyKey: `${key}:outbox` });
    });
    return this.state(workItemId);
  }

  async runDiscovery(workItemId: string, data: Record<string, unknown>) {
    await this.db.insert(discoveryRecords).values({ id: `discovery_${randomUUID()}`, workItemId, data }).onConflictDoUpdate({ target: discoveryRecords.workItemId, set: { data } });
    return this.transition(workItemId, 'INTAKE', 'PLANNING_GRADE', 'discovery.completed');
  }

  async runPlanning(workItemId: string) {
    const item = await this.state(workItemId);
    if (item.state !== 'PLANNING_GRADE') throw new Error(`Invalid transition: expected PLANNING_GRADE, found ${item.state}`);
    const run = await this.kernel.createRun({ workItemId, kind: 'planning', status: 'RUNNING' }, `${workItemId}:planning`);
    const result = await this.executor.execute({ mode: 'planning', runId: run.id, workItemId, intent: item.intent });
    await this.db.update(runs).set({ status: result.status.toUpperCase(), result, baselineRevision: result.repositoryRevisions.baseline, resultRevision: result.repositoryRevisions.result, updatedAt: new Date() }).where(eq(runs.id, run.id));
    if (result.status === 'blocked') return this.block(workItemId, run.id, 'PLANNING_GRADE', result);
    if (result.status !== 'done') throw new Error(`Planning failed: ${result.summary}`);
    const hash = digest(result);
    await this.db.insert(planningArtifacts).values({ id: `plan_${randomUUID()}`, workItemId, runId: run.id, path: result.artifactRefs[0] ?? '.', contentHash: hash, baselineRevision: result.repositoryRevisions.baseline, resultRevision: result.repositoryRevisions.result });
    await this.transition(workItemId, 'PLANNING_GRADE', 'AWAITING_PLANNING_APPROVAL', 'planning.completed', { artifactHash: hash });
    return { result, artifactHash: hash };
  }

  async recordPlanningApproval(workItemId: string, artifactHash: string, approver: string) {
    const [artifact] = await this.db.select().from(planningArtifacts).where(and(eq(planningArtifacts.workItemId, workItemId), eq(planningArtifacts.contentHash, artifactHash)));
    if (!artifact) throw new Error('Planning approval must reference a persisted artifact hash');
    await this.db.insert(approvals).values({ id: `approval_${randomUUID()}`, workItemId, phase: 'planning', artifactHash, artifactType: 'planning', repositoryRevision: artifact.resultRevision, approver });
    return this.transition(workItemId, 'AWAITING_PLANNING_APPROVAL', 'TECHNICAL_DISCOVERY', 'planning.approved', { artifactHash, approver });
  }

  async runTechnicalDiscovery(workItemId: string, data: Record<string, unknown>) {
    await this.db.insert(technicalRecords).values({ id: `technical_${randomUUID()}`, workItemId, data }).onConflictDoUpdate({ target: technicalRecords.workItemId, set: { data } });
    return this.transition(workItemId, 'TECHNICAL_DISCOVERY', 'IMPLEMENTATION_GRADE', 'technical-discovery.completed');
  }

  async runImplementation(workItemId: string) {
    const item = await this.state(workItemId);
    if (item.state !== 'IMPLEMENTATION_GRADE') throw new Error(`Invalid transition: expected IMPLEMENTATION_GRADE, found ${item.state}`);
    const run = await this.kernel.createRun({ workItemId, kind: 'implementation', status: 'RUNNING' }, `${workItemId}:implementation`);
    const result = await this.executor.execute({ mode: 'implementation', runId: run.id, workItemId, intent: item.intent });
    await this.db.update(runs).set({ status: result.status.toUpperCase(), result, baselineRevision: result.repositoryRevisions.baseline, resultRevision: result.repositoryRevisions.result, updatedAt: new Date() }).where(eq(runs.id, run.id));
    if (result.status === 'blocked') return this.block(workItemId, run.id, 'IMPLEMENTATION_GRADE', result);
    if (result.status !== 'done') throw new Error(`Implementation failed: ${result.summary}`);
    const hash = digest(result);
    await this.db.insert(implementationArtifacts).values({ id: `implementation_${randomUUID()}`, workItemId, runId: run.id, path: result.artifactRefs[0] ?? '.', contentHash: hash, baselineRevision: result.repositoryRevisions.baseline, resultRevision: result.repositoryRevisions.result });
    await this.transition(workItemId, 'IMPLEMENTATION_GRADE', 'AWAITING_IMPLEMENTATION_APPROVAL', 'implementation.completed', { artifactHash: hash });
    return { result, artifactHash: hash };
  }

  async recordImplementationApproval(workItemId: string, artifactHash: string, approver: string) {
    const [artifact] = await this.db.select().from(implementationArtifacts).where(and(eq(implementationArtifacts.workItemId, workItemId), eq(implementationArtifacts.contentHash, artifactHash)));
    if (!artifact) throw new Error('Implementation approval must reference a persisted artifact hash');
    const [run] = artifact.runId ? await this.db.select().from(runs).where(eq(runs.id, artifact.runId)) : [];
    const result = run?.result as RunResult | null;
    if (result && this.executor.finalize) await this.executor.finalize(workItemId, result);
    await this.db.insert(approvals).values({ id: `approval_${randomUUID()}`, workItemId, phase: 'implementation', artifactHash, artifactType: 'implementation', repositoryRevision: artifact.resultRevision, approver });
    return this.transition(workItemId, 'AWAITING_IMPLEMENTATION_APPROVAL', 'DONE', 'implementation.approved', { artifactHash, approver });
  }

  private async block(workItemId: string, runId: string, resumeState: State, result: RunResult) {
    const condition = result.blockingCondition!;
    await this.kernel.createQuestion({ workItemId, runId, question: condition.message, context: { code: condition.code }, resumeRef: { state: resumeState } }, `${runId}:blocked`);
    await this.transition(workItemId, resumeState, 'BLOCKED', 'execution.blocked', { runId, code: condition.code });
    return { result, blocked: true };
  }

  async answerQuestion(questionId: string, answer: string, actor: string) {
    const [question] = await this.db.select().from(questions).where(eq(questions.id, questionId));
    if (!question || question.status !== 'OPEN') throw new Error('Question is not open');
    const resumeState = (question.resumeRef as { state?: State } | null)?.state;
    if (!resumeState) throw new Error('Question has no resume state');
    await this.db.update(questions).set({ answer, status: 'ANSWERED', answeredAt: new Date() }).where(eq(questions.id, questionId));
    return this.transition(question.workItemId, 'BLOCKED', resumeState, 'question.answered', { questionId, actor });
  }
}
