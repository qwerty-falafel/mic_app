import { randomUUID } from 'node:crypto';
import { cp, access, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { auditEvents, conversationTurns, outboxEvents, repositories, storyUnits, workflowSessions, workstreams } from '../db/schema.js';
import { BmadRunnerAdapter, type WorkflowRunResult } from '../adapters/bmad-runner.js';
import { WorktreeManager } from '../worktree.js';
import { WorkstreamService } from './workstreams.js';
import { localMemory } from './resource-monitor.js';
import { provisionBmadCustomization } from './bmad-customization.js';

const sharedBmadRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../_bmad');
const micRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const exec = promisify(execFile);

export function conversationFromJsonl(stdout: string) {
  const events = stdout.split(/\r?\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const providerSessionId = events.find(event => typeof event.sessionID === 'string')?.sessionID as string | undefined;
  const content = events.filter(event => event.type === 'text' && typeof event.part?.text === 'string').map(event => event.part.text).join('\n').trim();
  return { providerSessionId, content };
}

export function awaitsInput(skill: string, content: string, artifactRefs: string[]) {
  if (skill === 'bmad-help') return false;
  void artifactRefs;
  const tail = content.slice(-3000).replace(/```[\s\S]*?```/g, '');
  const lines = tail.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const question = lines.some(line => /\?\s*$/.test(line));
  const explicitRequest = lines.slice(-20).some(line => /(?:^|[.!:]\s+)(?:please\s+)?(?:choose|select|reply|respond|provide|confirm|tell me|let me know)\b/i.test(line));
  const menu = lines.slice(-20).some(line => /^\[[a-z0-9]+\]\s+\S/i.test(line));
  return question || explicitRequest || menu;
}

export function reportsExecutionFailure(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return [
    /\bi (?:was|am) unable to (?:complete|finish|implement|perform|make|apply)\b/i,
    /\b(?:could not|couldn't|cannot|can't) (?:complete|finish|implement|perform|make|apply)\b/i,
    /\b(?:failed|failure) to (?:complete|finish|implement|perform|make|apply)\b/i,
  ].some(pattern => pattern.test(normalized));
}

export function preserveControlState(persisted: string | undefined, observed: string) {
  return persisted && ['PAUSED', 'CANCELLED', 'INTERRUPTED'].includes(persisted) ? persisted : observed;
}

export function storyStatusFromSession(status: string, doneCheckpoint: boolean) {
  return status === 'FINISHED' ? (doneCheckpoint ? 'review' : 'done') : status === 'BLOCKED' ? 'blocked' : status === 'FAILED' ? 'review' : status === 'WAITING_FOR_INPUT' ? 'in-progress' : undefined;
}

export function needsHumanClassification(skill: string, status: WorkflowRunResult['status'], waiting: boolean, artifactRefs: string[], rawAdapterState: Record<string, unknown>) {
  if (status !== 'done' || skill === 'bmad-help' || waiting || artifactRefs.length > 0) return false;
  const verifiedBuild = ['bmad-build', 'bmad-build-auto'].includes(skill) && (rawAdapterState.verification as { passed?: boolean } | undefined)?.passed === true;
  return !verifiedBuild;
}

export function canReviseSession(status: string) {
  return ['WAITING_FOR_INPUT', 'BLOCKED', 'INTERRUPTED', 'NEEDS_CLASSIFICATION', 'FINISHED', 'FAILED'].includes(status);
}

export function nodeVerificationScripts(packageText: string) {
  const value = JSON.parse(packageText);
  const scripts = value?.scripts && typeof value.scripts === 'object' ? value.scripts : {};
  return ['test', 'build'].filter(name => typeof scripts[name] === 'string' && scripts[name].trim()).map(name => ['run', name]);
}

export class WorkflowSessionService {
  readonly events = new EventEmitter();
  private readonly pending: Array<{ sessionId: string; task: () => Promise<void> }> = [];
  private active = false;
  constructor(private readonly db: Database, private readonly model: string, private readonly runner = new BmadRunnerAdapter(), private readonly trees = new WorktreeManager(), private readonly streams = new WorkstreamService(db), private readonly artifactsChanged?: (workstreamId: string, sessionId: string) => Promise<void>) {}

  private publish(sessionId: string, event: Record<string, unknown>) { this.events.emit(sessionId, event); }

  private schedule(sessionId: string, task: () => Promise<void>) { this.pending.push({ sessionId, task }); void this.pump(); }
  private async pump() {
    if (this.active || !this.pending.length) return;
    const memory = await localMemory();
    const next = this.pending[0]!;
    if (memory.availableMiB < 200 || memory.availableMiB / memory.totalMiB < .25) {
      await this.db.update(workflowSessions).set({ status: 'RESOURCE_WAITING', updatedAt: new Date() }).where(and(eq(workflowSessions.id, next.sessionId), inArray(workflowSessions.status, ['QUEUED', 'RESOURCE_WAITING'])));
      this.publish(next.sessionId, { type: 'status', status: 'RESOURCE_WAITING', memory });
      setTimeout(() => void this.pump(), 5000); return;
    }
    const { task } = this.pending.shift()!; this.active = true;
    try { await task(); } finally { this.active = false; void this.pump(); }
  }

  async start(input: { workstreamId: string; storyUnitId?: string; skill: string; action?: string; args?: Record<string, unknown>; prompt: string }, actor = 'api') {
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, input.workstreamId));
    if (!stream?.repositoryId) throw new Error('Workstream has no repository');
    const [repository] = await this.db.select().from(repositories).where(eq(repositories.id, stream.repositoryId));
    if (!repository) throw new Error('Repository not found');
    const eligible = await this.streams.operations(stream.id);
    const boundedStoryBuild = Boolean(input.storyUnitId && ['bmad-build', 'bmad-build-auto'].includes(input.skill));
    if (!boundedStoryBuild && !this.streams.operationIsEligible(eligible, input.skill, input.action)) throw new Error(`BMAD operation is not eligible for the selected ${stream.path} path`);
    if (['bmad-build', 'bmad-build-auto'].includes(input.skill) && stream.path !== 'direct' && !input.storyUnitId) throw new Error('Epic and project work can enter Build only through one bounded Story');
    if (input.storyUnitId) {
      const [story] = await this.db.select().from(storyUnits).where(and(eq(storyUnits.id, input.storyUnitId), eq(storyUnits.workstreamId, stream.id)));
      if (!story) throw new Error('Story does not belong to this Delivery Case');
    }
    const definition = await this.streams.requireDefinition(repository.id, input.skill, input.action);
    const sessionId = `session_${randomUUID()}`;
    let workspace = stream.workspacePath;
    if (!workspace) {
      const lease = await this.trees.create(repository.path, repository.baseBranch, stream.id, sessionId);
      workspace = lease.path;
      await this.db.update(workstreams).set({ workspacePath: lease.path, branch: lease.branch, baselineRevision: lease.baseline, updatedAt: new Date() }).where(eq(workstreams.id, stream.id));
      try { await access(resolve(workspace, '_bmad')); }
      catch {
        await cp(sharedBmadRoot, resolve(workspace, '_bmad'), { recursive: true });
        await writeFile(resolve(workspace, '_bmad/config.user.toml'), `[core]\nproject_name = ${JSON.stringify(basename(repository.path))}\nuser_name = "Michael"\ncommunication_language = "English"\ndocument_output_language = "English"\noutput_folder = ${JSON.stringify(resolve(workspace, '_bmad-output'))}\n\n[modules.bmm]\nuser_skill_level = "intermediate"\nplanning_artifacts = ${JSON.stringify(resolve(workspace, '_bmad-output/planning-artifacts'))}\nimplementation_artifacts = ${JSON.stringify(resolve(workspace, '_bmad-output/implementation-artifacts'))}\nproject_knowledge = ${JSON.stringify(resolve(workspace, 'docs'))}\n`);
      }
    }
    await provisionBmadCustomization(sharedBmadRoot, workspace);
    await mkdir(resolve(workspace, '.agents'), { recursive: true });
    await mkdir(resolve(workspace, '.opencode'), { recursive: true });
    await cp(resolve(micRoot, '.agents/skills'), resolve(workspace, '.agents/skills'), { recursive: true, force: true });
    await cp(resolve(micRoot, '.opencode/commands'), resolve(workspace, '.opencode/commands'), { recursive: true, force: true });
    try { await symlink('../.agents/skills', resolve(workspace, '.opencode/skills'), 'dir'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const [row] = await this.db.transaction(async tx => {
      const [created] = await tx.insert(workflowSessions).values({ id: sessionId, workstreamId: stream.id, definitionId: definition.id, storyUnitId: input.storyUnitId, skill: input.skill, action: input.action, args: input.args ?? {}, prompt: input.prompt, status: 'QUEUED', rawState: { workspace } }).returning();
      if (input.storyUnitId) await tx.update(storyUnits).set({ status: 'queued', updatedAt: new Date() }).where(eq(storyUnits.id, input.storyUnitId));
      await tx.insert(conversationTurns).values({ id: `turn_${randomUUID()}`, sessionId, sequence: 1, role: 'user', content: input.prompt, commandKey: `${sessionId}:initial` });
      await tx.insert(auditEvents).values({ aggregateType: 'workflow_session', aggregateId: sessionId, action: 'started', actor, detail: { skill: input.skill, action: input.action }, idempotencyKey: `${sessionId}:started` });
      await tx.insert(outboxEvents).values({ id: `evt_${randomUUID()}`, topic: 'workflow_session.started', payload: { id: sessionId, workstreamId: stream.id, skill: input.skill }, idempotencyKey: `${sessionId}:started` });
      return [created];
    });
    const baseline = stream.baselineRevision ?? (await exec('git', ['-C', repository.path, 'rev-parse', repository.baseBranch])).stdout.trim();
    this.schedule(sessionId, async () => { const [current] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId)); if (current?.status === 'CANCELLED') return; await this.db.update(workflowSessions).set({ status: 'RUNNING', updatedAt: new Date() }).where(eq(workflowSessions.id, sessionId)); this.publish(sessionId, { type: 'status', status: 'RUNNING' }); await this.execute({ ...row!, status: 'RUNNING' }, repository.path, workspace, baseline); });
    return row;
  }

  private async execute(session: typeof workflowSessions.$inferSelect, repository: string, workspace: string, baseline: string) {
    const turns = await this.db.select().from(conversationTurns).where(eq(conversationTurns.sessionId, session.id)).orderBy(asc(conversationTurns.sequence));
    const runId = `${session.id}-${turns.length}`;
    try {
      const result = await this.runner.execute({ runId, skill: session.skill, action: session.action ?? undefined, args: session.args as Record<string, unknown>, prompt: turns.at(-1)!.content, repository, workspace, baseline, model: this.model, providerSessionId: session.providerSessionId ?? undefined });
      const parsed = conversationFromJsonl(String(result.rawAdapterState.stdout ?? ''));
      if (result.status === 'done' && reportsExecutionFailure(parsed.content)) {
        result.status = 'failed';
        result.summary = `${session.skill} reported that it could not complete the requested work`;
        result.rawAdapterState = { ...result.rawAdapterState, reportedFailure: parsed.content };
      }
      if (result.status === 'done' && ['bmad-build', 'bmad-build-auto'].includes(session.skill)) {
        const verification = await this.verifyBuild(workspace);
        result.rawAdapterState = { ...result.rawAdapterState, verification };
        result.evidenceRefs = [...result.evidenceRefs, ...verification.checks.filter(check => check.passed).map(check => `command:${check.command}`)];
        if (!verification.passed) {
          result.status = 'failed';
          result.summary = `${session.skill} failed repository verification`;
          result.rawAdapterState.stderr = [String(result.rawAdapterState.stderr ?? ''), verification.checks.filter(check => !check.passed).map(check => `${check.command}: ${check.output}`).join('\n')].filter(Boolean).join('\n');
        }
      }
      await this.completeTurn(session, result);
    } catch (error) {
      await this.db.update(workflowSessions).set({ status: 'FAILED', finishedAt: new Date(), updatedAt: new Date(), rawState: { workspace, error: String(error), lastRunId: runId } }).where(eq(workflowSessions.id, session.id));
      this.publish(session.id, { type: 'status', status: 'FAILED', error: String(error) });
    }
  }

  private async verifyBuild(workspace: string) {
    const checks: Array<{ command: string; passed: boolean; output: string }> = [];
    let scripts: string[][];
    try { scripts = nodeVerificationScripts(await readFile(resolve(workspace, 'package.json'), 'utf8')); }
    catch (error) { return { passed: false, checks: [{ command: 'parse package.json', passed: false, output: String(error) }] }; }
    for (const args of scripts) {
      const command = `npm ${args.join(' ')}`;
      try {
        const value = await exec('npm', args, { cwd: workspace, timeout: 300_000 });
        checks.push({ command, passed: true, output: `${value.stdout}${value.stderr}`.trim().slice(-8000) });
      } catch (error: any) {
        checks.push({ command, passed: false, output: `${error?.stdout ?? ''}${error?.stderr ?? ''}${error?.message ?? error}`.trim().slice(-8000) });
      }
    }
    return { passed: checks.every(check => check.passed), checks };
  }

  private async completeTurn(session: typeof workflowSessions.$inferSelect, result: WorkflowRunResult) {
    const parsed = conversationFromJsonl(String(result.rawAdapterState.stdout ?? ''));
    const existing = await this.db.select().from(conversationTurns).where(eq(conversationTurns.sessionId, session.id));
    const waiting = result.status === 'done' && awaitsInput(session.skill, parsed.content, result.artifactRefs);
    const ambiguous = needsHumanClassification(session.skill, result.status, waiting, result.artifactRefs, result.rawAdapterState);
    const [persisted] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, session.id));
    const observedStatus = result.status === 'blocked' ? 'BLOCKED' : result.status === 'cancelled' ? 'CANCELLED' : result.status === 'failed' ? 'FAILED' : waiting ? 'WAITING_FOR_INPUT' : ambiguous ? 'NEEDS_CLASSIFICATION' : 'FINISHED';
    // Pause and cancel update the durable state before SIGTERM reaches OpenCode.
    // The ensuing process observation must not reinterpret an intentional pause
    // as a cancellation or undo an explicit cancellation.
    const status = preserveControlState(persisted?.status, observedStatus);
    const workspace = String(result.rawAdapterState.worktree ?? '');
    if (workspace) {
      await exec('git', ['-C', workspace, 'add', '-A', '--', '.', ':(exclude)_bmad', ':(exclude).mic', ':(exclude).agents', ':(exclude).opencode']);
      const staged = (await exec('git', ['-C', workspace, 'diff', '--cached', '--name-only'])).stdout.trim();
      if (staged) await exec('git', ['-C', workspace, '-c', 'user.name=MIC', '-c', 'user.email=mic@localhost', 'commit', '-m', `MIC ${session.skill} ${session.id}`]);
      result.repositoryRevisions.result = (await exec('git', ['-C', workspace, 'rev-parse', 'HEAD'])).stdout.trim();
    }
    const storyKey = (session.args as Record<string, unknown>)?.storyId;
    const [relatedStory] = typeof storyKey === 'string' ? await this.db.select().from(storyUnits).where(and(eq(storyUnits.workstreamId, session.workstreamId), eq(storyUnits.storyKey, storyKey))) : [];
    await this.db.transaction(async tx => {
      if (parsed.content) await tx.insert(conversationTurns).values({ id: `turn_${randomUUID()}`, sessionId: session.id, sequence: existing.length + 1, role: 'assistant', content: parsed.content, metadata: { artifactRefs: result.artifactRefs } });
      await tx.update(workflowSessions).set({ status, providerSessionId: parsed.providerSessionId ?? session.providerSessionId, rawState: result, updatedAt: new Date(), finishedAt: ['FINISHED', 'FAILED', 'CANCELLED'].includes(status) ? new Date() : null }).where(eq(workflowSessions.id, session.id));
      if (typeof storyKey === 'string') {
        const needsDoneAcceptance = Boolean((relatedStory?.metadata as any)?.outcome?.doneCheckpoint);
        const storyStatus = storyStatusFromSession(status, needsDoneAcceptance);
        const metadata = { ...((relatedStory?.metadata as Record<string, unknown>) ?? {}), sessionId: session.id, artifactRefs: result.artifactRefs, repositoryRevision: result.repositoryRevisions.result };
        if (storyStatus) await tx.update(storyUnits).set({ status: storyStatus, metadata, updatedAt: new Date() }).where(and(eq(storyUnits.workstreamId, session.workstreamId), eq(storyUnits.storyKey, storyKey)));
      }
      await tx.insert(auditEvents).values({ aggregateType: 'workflow_session', aggregateId: session.id, action: status.toLowerCase(), actor: 'system', detail: { summary: result.summary, artifactRefs: result.artifactRefs }, idempotencyKey: `${session.id}:${existing.length}:${status}` }).onConflictDoNothing();
    });
    if (status === 'FINISHED' && this.artifactsChanged) await this.artifactsChanged(session.workstreamId, session.id);
    this.publish(session.id, { type: 'turn', status, content: parsed.content, artifactRefs: result.artifactRefs });
  }

  async respond(sessionId: string, content: string, actor = 'api', commandKey: string = randomUUID()) {
    return this.continueSession(sessionId, content, actor, commandKey, ['WAITING_FOR_INPUT', 'BLOCKED', 'INTERRUPTED']);
  }

  async revise(sessionId: string, content: string, actor = 'api', commandKey: string = randomUUID()) {
    const [session] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId));
    if (!session) throw new Error('Workflow session not found');
    if (!canReviseSession(session.status)) throw new Error('Workflow session is not available for revision');
    return this.continueSession(sessionId, content, actor, commandKey, [session.status]);
  }

  private async continueSession(sessionId: string, content: string, actor: string, commandKey: string, allowedStatuses: string[]) {
    const [session] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId));
    if (!session) throw new Error('Workflow session not found');
    const [duplicate] = await this.db.select().from(conversationTurns).where(and(eq(conversationTurns.sessionId, sessionId), eq(conversationTurns.commandKey, commandKey))).limit(1);
    if (duplicate) return { sessionId, status: session.status, duplicate: true };
    if (!allowedStatuses.includes(session.status)) throw new Error('Workflow session is not available for continuation');
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, session.workstreamId));
    const [repository] = stream?.repositoryId ? await this.db.select().from(repositories).where(eq(repositories.id, stream.repositoryId)) : [];
    if (!stream?.workspacePath || !repository) throw new Error('Workflow workspace is unavailable');
    const turns = await this.db.select().from(conversationTurns).where(eq(conversationTurns.sessionId, sessionId));
    const inserted = await this.db.transaction(async tx => {
      const created = await tx.insert(conversationTurns).values({ id: `turn_${randomUUID()}`, sessionId, sequence: Math.max(0, ...turns.map(turn => turn.sequence)) + 1, role: 'user', content, commandKey, metadata: { actor } }).onConflictDoNothing().returning();
      if (!created.length) return false;
      await tx.update(workflowSessions).set({ status: 'QUEUED', updatedAt: new Date(), finishedAt: null }).where(eq(workflowSessions.id, sessionId));
      return true;
    });
    if (!inserted) return { sessionId, status: session.status, duplicate: true };
    this.schedule(sessionId, async () => { const [current] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId)); if (current?.status === 'CANCELLED') return; await this.db.update(workflowSessions).set({ status: 'RUNNING', updatedAt: new Date() }).where(eq(workflowSessions.id, sessionId)); await this.execute({ ...session, status: 'RUNNING' }, repository.path, stream.workspacePath!, stream.baselineRevision!); });
    return { sessionId, status: 'QUEUED' };
  }

  async classify(sessionId: string, classification: 'waiting' | 'finished', actor = 'api') {
    const [session] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId));
    const correctingFalseWait = session?.status === 'WAITING_FOR_INPUT' && classification === 'finished';
    if (!session || (session.status !== 'NEEDS_CLASSIFICATION' && !correctingFalseWait)) throw new Error('Workflow session does not need classification');
    const status = classification === 'waiting' ? 'WAITING_FOR_INPUT' : 'FINISHED';
    await this.db.update(workflowSessions).set({ status, updatedAt: new Date(), finishedAt: status === 'FINISHED' ? new Date() : null }).where(eq(workflowSessions.id, sessionId));
    await this.db.insert(auditEvents).values({ aggregateType: 'workflow_session', aggregateId: sessionId, action: correctingFalseWait ? 'false_wait.corrected' : 'classified', actor, detail: { classification }, idempotencyKey: `${sessionId}:classified:${classification}` }).onConflictDoNothing();
    return { sessionId, status };
  }

  async pause(sessionId: string, actor = 'api') {
    const [session] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId));
    if (!session || session.status !== 'RUNNING') throw new Error('Workflow session is not running');
    const turns = await this.turns(sessionId); this.runner.cancel(`${session.id}-${turns.length}`);
    await this.db.update(workflowSessions).set({ status: 'PAUSED', updatedAt: new Date() }).where(eq(workflowSessions.id, sessionId));
    await this.db.insert(auditEvents).values({ aggregateType: 'workflow_session', aggregateId: sessionId, action: 'paused', actor, detail: {}, idempotencyKey: `${sessionId}:paused:${turns.length}` }).onConflictDoNothing();
    return { sessionId, status: 'PAUSED' };
  }

  async resume(sessionId: string, actor = 'api', commandKey: string = randomUUID()) {
    const [session] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId));
    if (!session || !['PAUSED', 'INTERRUPTED', 'FAILED'].includes(session.status)) throw new Error('Workflow session cannot be resumed');
    await this.db.update(workflowSessions).set({ status: 'WAITING_FOR_INPUT', updatedAt: new Date() }).where(eq(workflowSessions.id, sessionId));
    return this.respond(sessionId, 'Continue from the last durable workflow checkpoint. Do not repeat completed work.', actor, commandKey);
  }

  list(workstreamId?: string) { return workstreamId ? this.db.select().from(workflowSessions).where(eq(workflowSessions.workstreamId, workstreamId)).orderBy(desc(workflowSessions.createdAt)) : this.db.select().from(workflowSessions).orderBy(desc(workflowSessions.createdAt)); }
  turns(sessionId: string) { return this.db.select().from(conversationTurns).where(eq(conversationTurns.sessionId, sessionId)).orderBy(asc(conversationTurns.sequence)); }

  async cancel(sessionId: string, actor = 'api') {
    const [session] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId));
    if (!session || !['RUNNING', 'QUEUED', 'RESOURCE_WAITING'].includes(session.status)) throw new Error('Workflow session is not active');
    const turns = await this.turns(sessionId); const runId = `${session.id}-${turns.length}`;
    if (session.status === 'RUNNING') this.runner.cancel(runId);
    await this.db.update(workflowSessions).set({ status: 'CANCELLED', finishedAt: new Date(), updatedAt: new Date() }).where(eq(workflowSessions.id, sessionId));
    await this.db.insert(auditEvents).values({ aggregateType: 'workflow_session', aggregateId: sessionId, action: 'cancelled', actor, detail: {}, idempotencyKey: `${sessionId}:cancelled` }).onConflictDoNothing();
    this.publish(sessionId, { type: 'status', status: 'CANCELLED' });
    return { sessionId, status: 'CANCELLED' };
  }

  async recoverActive() {
    const active = await this.db.select().from(workflowSessions).where(inArray(workflowSessions.status, ['QUEUED', 'RUNNING']));
    for (const session of active) await this.db.update(workflowSessions).set({ status: 'INTERRUPTED', updatedAt: new Date() }).where(eq(workflowSessions.id, session.id));
    return active.length;
  }

  async interruptActive() {
    const active = await this.db.select().from(workflowSessions).where(inArray(workflowSessions.status, ['QUEUED', 'RUNNING', 'RESOURCE_WAITING']));
    for (const session of active) {
      const turns = await this.turns(session.id);
      await this.db.update(workflowSessions).set({ status: 'INTERRUPTED', updatedAt: new Date() }).where(eq(workflowSessions.id, session.id));
      if (session.status === 'RUNNING') this.runner.cancel(`${session.id}-${turns.length}`);
      this.publish(session.id, { type: 'status', status: 'INTERRUPTED' });
    }
    return active.length;
  }
}
