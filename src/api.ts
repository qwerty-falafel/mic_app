import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database } from './db/client.js';
import { Kernel } from './kernel.js';
import { LifecycleService, type LifecycleExecutor } from './services/lifecycle.js';

const id = z.string().min(1);
const projectInput = z.object({ name: z.string().min(1) });
const repositoryInput = z.object({ path: z.string().min(1), role: z.string().min(1).optional(), baseBranch: z.string().min(1).optional() });
const workItemInput = z.object({ projectId: id, title: z.string().min(1), intent: z.string().min(1), kind: z.string().optional(), state: z.string().optional(), priority: z.number().int().optional() });
const runInput = z.object({ workItemId: id, kind: z.string().min(1), model: z.string().optional(), status: z.string().optional(), baselineRevision: z.string().optional() });
const questionInput = z.object({ workItemId: id, runId: id.optional(), question: z.string().min(1), context: z.record(z.string(), z.unknown()).optional(), resumeRef: z.record(z.string(), z.unknown()).optional() });

export function createApp(db: Database, executor?: LifecycleExecutor) {
  const app = Fastify({ logger: false });
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
  app.post('/projects', async (request, reply) => reply.code(201).send(await kernel.createProject(projectInput.parse(request.body), key(request))));
  app.post('/projects/:id/repositories', async (request, reply) => {
    const { id: projectId } = z.object({ id }).parse(request.params);
    return reply.code(201).send(await kernel.createRepository({ projectId, ...repositoryInput.parse(request.body) }, key(request)));
  });
  app.post('/work-items', async (request, reply) => reply.code(201).send(await kernel.createWorkItem(workItemInput.parse(request.body), key(request))));
  app.post('/runs', async (request, reply) => reply.code(201).send(await kernel.createRun(runInput.parse(request.body), key(request))));
  app.post('/questions', async (request, reply) => reply.code(201).send(await kernel.createQuestion(questionInput.parse(request.body), key(request))));
  for (const kind of ['projects', 'repositories', 'work-items', 'runs', 'questions'] as const) {
    app.get(`/${kind}/:id`, async (request, reply) => {
      const { id: entityId } = z.object({ id }).parse(request.params);
      const row = await kernel.get(kind, entityId);
      return row ? reply.send(row) : reply.code(404).send({ error: 'not_found' });
    });
  }
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
