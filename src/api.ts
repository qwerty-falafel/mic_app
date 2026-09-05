import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from './db/client.js';
import { approvals, auditEvents, evidenceRecords, implementationArtifacts, outboxEvents, planningArtifacts, processedEvents, projects, questions, repositories, runs, workItems } from './db/schema.js';
import { Kernel } from './kernel.js';
import { LifecycleService, type LifecycleExecutor } from './services/lifecycle.js';
import { evaluateGates, type Evidence } from './gates/validator.js';
import { localMemory } from './services/resource-monitor.js';

const id = z.string().min(1);
const projectInput = z.object({ name: z.string().min(1) });
const repositoryInput = z.object({ path: z.string().min(1), role: z.string().min(1).optional(), baseBranch: z.string().min(1).optional() });
const workItemInput = z.object({ projectId: id, title: z.string().min(1), intent: z.string().min(1), kind: z.string().optional(), state: z.string().optional(), priority: z.number().int().optional() });
const runInput = z.object({ workItemId: id, kind: z.string().min(1), model: z.string().optional(), status: z.string().optional(), baselineRevision: z.string().optional() });
const questionInput = z.object({ workItemId: id, runId: id.optional(), question: z.string().min(1), context: z.record(z.string(), z.unknown()).optional(), resumeRef: z.record(z.string(), z.unknown()).optional() });

export function createApp(db: Database, executor?: LifecycleExecutor) {
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: true });
  void app.register(swagger, { mode: 'static', specification: { path: resolve('docs/openapi.json'), baseDir: resolve('docs') } });
  void app.register(swaggerUi, { routePrefix: '/docs' });
  const frontend = resolve('frontend/dist');
  if (existsSync(frontend)) void app.register(fastifyStatic, { root: frontend, wildcard: false });
  const kernel = new Kernel(db);
  const lifecycle = executor ? new LifecycleService(db, executor) : undefined;
  const key = (request: { headers: Record<string, unknown> }) => typeof request.headers['idempotency-key'] === 'string' ? request.headers['idempotency-key'] : randomUUID();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'validation_error', issues: error.issues });
    if ((error as any).code === '23503') return reply.code(409).send({ error: 'missing_reference' });
    if (error instanceof Error && error.message.startsWith('Invalid transition')) return reply.code(409).send({ error: 'invalid_transition', message: error.message });
    return reply.send(error);
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/system/status', async () => {
    const [memory, [projectCount], [workItemCount], [activeRuns], [pendingOutbox]] = await Promise.all([
      localMemory(), db.select({ value: count() }).from(projects), db.select({ value: count() }).from(workItems), db.select({ value: count() }).from(runs).where(eq(runs.status, 'RUNNING')), db.select({ value: count() }).from(outboxEvents).where(isNull(outboxEvents.deliveredAt)),
    ]);
    let router: Record<string, unknown> = { status: 'unavailable' };
    try { router = await (await fetch('http://127.0.0.1:10000/health', { signal: AbortSignal.timeout(1000) })).json() as Record<string, unknown>; } catch {}
    return { status: 'ok', database: 'connected', router, memory, counts: { projects: projectCount.value, workItems: workItemCount.value, activeRuns: activeRuns.value, pendingOutbox: pendingOutbox.value } };
  });
  app.post('/projects', async (request, reply) => reply.code(201).send(await kernel.createProject(projectInput.parse(request.body), key(request))));
  app.post('/projects/:id/repositories', async (request, reply) => {
    const { id: projectId } = z.object({ id }).parse(request.params);
    return reply.code(201).send(await kernel.createRepository({ projectId, ...repositoryInput.parse(request.body) }, key(request)));
  });
  app.post('/work-items', async (request, reply) => reply.code(201).send(await kernel.createWorkItem(workItemInput.parse(request.body), key(request))));
  app.post('/runs', async (request, reply) => reply.code(201).send(await kernel.createRun(runInput.parse(request.body), key(request))));
  app.post('/questions', async (request, reply) => reply.code(201).send(await kernel.createQuestion(questionInput.parse(request.body), key(request))));
  app.get('/projects', async () => db.select().from(projects).orderBy(desc(projects.createdAt)));
  app.get('/repositories', async request => { const query = z.object({ projectId: id.optional() }).parse(request.query); return query.projectId ? db.select().from(repositories).where(eq(repositories.projectId, query.projectId)) : db.select().from(repositories); });
  app.get('/work-items', async request => { const query = z.object({ projectId: id.optional() }).parse(request.query); return query.projectId ? db.select().from(workItems).where(eq(workItems.projectId, query.projectId)).orderBy(desc(workItems.createdAt)) : db.select().from(workItems).orderBy(desc(workItems.createdAt)); });
  app.get('/runs', async request => { const query = z.object({ workItemId: id.optional() }).parse(request.query); return query.workItemId ? db.select().from(runs).where(eq(runs.workItemId, query.workItemId)).orderBy(desc(runs.createdAt)) : db.select().from(runs).orderBy(desc(runs.createdAt)); });
  app.get('/questions', async request => { const query = z.object({ status: id.optional(), workItemId: id.optional() }).parse(request.query); const clauses = [query.status ? eq(questions.status, query.status) : undefined, query.workItemId ? eq(questions.workItemId, query.workItemId) : undefined].filter(Boolean) as any[]; return db.select().from(questions).where(clauses.length ? and(...clauses) : undefined).orderBy(desc(questions.createdAt)); });
  app.get('/approvals', async request => { const query = z.object({ workItemId: id.optional() }).parse(request.query); return query.workItemId ? db.select().from(approvals).where(eq(approvals.workItemId, query.workItemId)).orderBy(desc(approvals.createdAt)) : db.select().from(approvals).orderBy(desc(approvals.createdAt)); });
  for (const kind of ['projects', 'repositories', 'work-items', 'runs', 'questions'] as const) {
    app.get(`/${kind}/:id`, async (request, reply) => {
      const { id: entityId } = z.object({ id }).parse(request.params);
      const row = await kernel.get(kind, entityId);
      return row ? reply.send(row) : reply.code(404).send({ error: 'not_found' });
    });
  }
  app.get('/work-items/:id/detail', async request => {
    const { id: workItemId } = z.object({ id }).parse(request.params);
    const item = await kernel.get('work-items', workItemId);
    if (!item) return null;
    const [itemRuns, itemQuestions, itemApprovals, timeline, plans, implementations] = await Promise.all([
      db.select().from(runs).where(eq(runs.workItemId, workItemId)).orderBy(desc(runs.createdAt)), db.select().from(questions).where(eq(questions.workItemId, workItemId)).orderBy(desc(questions.createdAt)), db.select().from(approvals).where(eq(approvals.workItemId, workItemId)), db.select().from(auditEvents).where(and(eq(auditEvents.aggregateType, 'work_item'), eq(auditEvents.aggregateId, workItemId))).orderBy(auditEvents.createdAt), db.select().from(planningArtifacts).where(eq(planningArtifacts.workItemId, workItemId)), db.select().from(implementationArtifacts).where(eq(implementationArtifacts.workItemId, workItemId)),
    ]);
    return { item, runs: itemRuns, questions: itemQuestions, approvals: itemApprovals, timeline, artifacts: [...plans.map(value => ({ ...value, type: 'planning' })), ...implementations.map(value => ({ ...value, type: 'implementation' }))] };
  });
  app.get('/runs/:id/evidence', async request => { const { id: runId } = z.object({ id }).parse(request.params); return db.select().from(evidenceRecords).where(eq(evidenceRecords.runId, runId)); });
  app.get('/runs/:id/logs', async (request, reply) => { const { id: runId } = z.object({ id }).parse(request.params); const [run] = await db.select().from(runs).where(eq(runs.id, runId)); if (!run) return reply.code(404).send({ error: 'not_found' }); const raw = (run.result as any)?.rawAdapterState ?? {}; return { runId, stdout: raw.stdout ?? '', stderr: raw.stderr ?? '', startedAt: raw.startedAt, finishedAt: raw.finishedAt }; });
  app.get('/artifacts/:type/:id/content', async (request, reply) => { const params = z.object({ type: z.enum(['planning', 'implementation']), id }).parse(request.params); const table = params.type === 'planning' ? planningArtifacts : implementationArtifacts; const [artifact] = await db.select().from(table as any).where(eq((table as any).id, params.id)); if (!artifact) return reply.code(404).send({ error: 'not_found' }); const [run] = artifact.runId ? await db.select().from(runs).where(eq(runs.id, artifact.runId)) : []; const root = (run?.result as any)?.rawAdapterState?.worktree; if (!root) return reply.code(409).send({ error: 'artifact_unavailable' }); const path = resolve(root, artifact.path); if (path !== resolve(root) && !path.startsWith(resolve(root) + sep)) return reply.code(400).send({ error: 'invalid_artifact_path' }); return reply.type('text/plain').send(await readFile(path, 'utf8')); });
  app.post('/evidence', async (request, reply) => { const body = z.object({ runId: id, repositoryId: id, kind: z.enum(['BUILD_PASS', 'TESTS_PASS']), revision: id, passed: z.boolean(), data: z.unknown() }).parse(request.body); const [row] = await db.insert(evidenceRecords).values({ id: `evidence_${randomUUID()}`, ...body }).returning(); return reply.code(201).send(row); });
  app.get('/runs/:id/gates', async request => { const { id: runId } = z.object({ id }).parse(request.params); const [run] = await db.select().from(runs).where(eq(runs.id, runId)); if (!run) return null; const records = await db.select().from(evidenceRecords).where(eq(evidenceRecords.runId, runId)); return evaluateGates(run.resultRevision ?? '', records.map(row => ({ kind: row.kind, revision: row.revision, passed: row.passed, data: row.data }) as Evidence)); });
  app.post('/runs/:id/cancel', async (request, reply) => { const { id: runId } = z.object({ id }).parse(request.params); const [run] = await db.select().from(runs).where(eq(runs.id, runId)); if (!run) return reply.code(404).send({ error: 'not_found' }); if (!['RUNNING', 'QUEUED'].includes(run.status)) return reply.code(409).send({ error: 'run_not_active' }); const cancelled = executor?.cancel?.(runId) ?? false; if (!cancelled) return reply.code(409).send({ error: 'active_process_not_found' }); await db.update(runs).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(runs.id, runId)); return reply.send({ runId, cancelled }); });
  app.get('/resources', async () => ({ ...(await localMemory()), thresholds: { minimumAvailableMiB: 200, minimumAvailableFraction: 0.25, swapMustBeZero: true } }));
  app.get('/scheduler', async () => { const [[pending], [processed]] = await Promise.all([db.select({ value: count() }).from(outboxEvents).where(isNull(outboxEvents.deliveredAt)), db.select({ value: count() }).from(processedEvents)]); return { pendingOutbox: pending.value, processedEvents: processed.value, mode: 'single-model' }; });
  const requireLifecycle = () => { if (!lifecycle) throw new Error('Lifecycle executor is not configured'); return lifecycle; };
  app.post('/work-items/:id/discovery', async request => { const { id: entityId } = z.object({ id }).parse(request.params); return requireLifecycle().runDiscovery(entityId, z.record(z.string(), z.unknown()).parse(request.body)); });
  app.post('/work-items/:id/planning', async request => { const { id: entityId } = z.object({ id }).parse(request.params); return requireLifecycle().runPlanning(entityId); });
  app.post('/work-items/:id/planning-approval', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const body = z.object({ artifactHash: id, approver: id }).parse(request.body); return requireLifecycle().recordPlanningApproval(entityId, body.artifactHash, body.approver); });
  app.post('/work-items/:id/technical-discovery', async request => { const { id: entityId } = z.object({ id }).parse(request.params); return requireLifecycle().runTechnicalDiscovery(entityId, z.record(z.string(), z.unknown()).parse(request.body)); });
  app.post('/work-items/:id/implementation', async request => { const { id: entityId } = z.object({ id }).parse(request.params); return requireLifecycle().runImplementation(entityId); });
  app.post('/work-items/:id/implementation-approval', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const body = z.object({ artifactHash: id, approver: id }).parse(request.body); return requireLifecycle().recordImplementationApproval(entityId, body.artifactHash, body.approver); });
  app.post('/questions/:id/answer', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const body = z.object({ answer: z.string().min(1), actor: id }).parse(request.body); return requireLifecycle().answerQuestion(entityId, body.answer, body.actor); });
  return app;
}
