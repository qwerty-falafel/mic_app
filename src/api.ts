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
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from './db/client.js';
import { approvals, artifactRevisions, auditEvents, evidenceRecords, implementationArtifacts, outboxEvents, planningArtifacts, processedEvents, productGoals, projects, questions, repositories, reviewDecisions, runs, workItems, workflowSessions, workstreams } from './db/schema.js';
import { Kernel } from './kernel.js';
import { LifecycleService, type LifecycleExecutor } from './services/lifecycle.js';
import { evaluateGates, type Evidence } from './gates/validator.js';
import { localDisk, localMemory } from './services/resource-monitor.js';
import { BmadCatalogService } from './services/bmad-catalog.js';
import { WorkstreamService } from './services/workstreams.js';
import { WorkflowSessionService } from './services/workflow-sessions.js';
import { ArtifactService } from './services/artifacts.js';
import { StoryDeliveryService } from './services/story-delivery.js';
import { repositoryHealth } from './services/repository-health.js';
import { ProductService } from './services/products.js';
import { DeliveryProjectionService } from './services/delivery-projection.js';
import { ScrumService } from './services/scrum.js';
import { GptOssProposalAnalyzer, ProductProposalService, type ProductProposalAnalyzer } from './services/product-proposals.js';
import { BmadRoutingService } from './services/bmad-routing.js';
import { runtimeResponsibilities } from './services/runtime-responsibilities.js';
import { ProductTraceService } from './services/product-trace.js';
import type { WebSecurityConfig } from './config.js';
import { installRequestSecurity, requestActor, type AccessVerifier } from './security.js';

const id = z.string().min(1);
const projectInput = z.object({ name: z.string().trim().min(1), purpose: z.string().trim().optional(), status: z.enum(['active', 'archived']).optional(), definitionOfDone: z.string().trim().min(1).optional() });
const repositoryInput = z.object({ path: z.string().min(1), role: z.string().min(1).optional(), baseBranch: z.string().min(1).optional() });
const workItemInput = z.object({ projectId: id, title: z.string().min(1), intent: z.string().min(1), kind: z.string().optional(), state: z.string().optional(), priority: z.number().int().optional() });
const runInput = z.object({ workItemId: id, kind: z.string().min(1), model: z.string().optional(), status: z.string().optional(), baselineRevision: z.string().optional() });
const questionInput = z.object({ workItemId: id, runId: id.optional(), question: z.string().min(1), context: z.record(z.string(), z.unknown()).optional(), resumeRef: z.record(z.string(), z.unknown()).optional() });

export function isBrowserDocumentRequest(request: { method: string; headers: Record<string, unknown> }) {
  return request.method === 'GET' && String(request.headers.accept ?? '').includes('text/html');
}

export function createApp(db: Database, executor?: LifecycleExecutor, proposalAnalyzer?: ProductProposalAnalyzer, options: { webSecurity?: WebSecurityConfig; accessVerifier?: AccessVerifier } = {}) {
  const webSecurity = options.webSecurity ?? { mode: 'local', allowedOrigins: ['http://127.0.0.1:3100', 'http://localhost:3100'] };
  const app = Fastify({ logger: false, trustProxy: webSecurity.mode === 'remote' ? '127.0.0.1' : false, bodyLimit: 2 * 1024 * 1024 });
  installRequestSecurity(app, webSecurity, options.accessVerifier);
  void app.register(cors, { origin: webSecurity.allowedOrigins, credentials: webSecurity.mode === 'remote' });
  void app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"] } } });
  void app.register(rateLimit, { global: true, max: webSecurity.mode === 'remote' ? 600 : 10_000, timeWindow: '1 minute', keyGenerator: request => request.micActor || request.ip });
  void app.register(swagger, { mode: 'static', specification: { path: resolve('docs/openapi.json'), baseDir: resolve('docs') } });
  void app.register(swaggerUi, { routePrefix: '/docs' });
  const frontend = resolve('frontend/dist');
  if (existsSync(frontend)) void app.register(fastifyStatic, { root: frontend, wildcard: false });
  const kernel = new Kernel(db);
  const lifecycle = executor ? new LifecycleService(db, executor) : undefined;
  const catalog = new BmadCatalogService(db);
  const streams = new WorkstreamService(db);
  const artifacts = new ArtifactService(db);
  const sessions = new WorkflowSessionService(db, process.env.MIC_MODEL ?? 'llama.cpp/gpt-oss-120b-F16', undefined, undefined, streams, async (workstreamId, sessionId) => { await artifacts.index(workstreamId, sessionId); });
  const stories = new StoryDeliveryService(db);
  const products = new ProductService(db);
  const delivery = new DeliveryProjectionService(db);
  const scrum = new ScrumService(db);
  const proposals = new ProductProposalService(db, proposalAnalyzer ?? new GptOssProposalAnalyzer());
  const routing = new BmadRoutingService(db);
  const trace = new ProductTraceService(db);
  void sessions.recoverActive();
  app.addHook('onClose', async () => { await sessions.interruptActive(); });
  const key = (request: { headers: Record<string, unknown> }) => typeof request.headers['idempotency-key'] === 'string' ? request.headers['idempotency-key'] : randomUUID();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'validation_error', issues: error.issues });
    if ((error as any).code === '23503') return reply.code(409).send({ error: 'missing_reference' });
    if ((error as any).code === '23505') return reply.code(409).send({ error: 'conflict', message: error instanceof Error ? error.message : String(error) });
    if (error instanceof Error && error.message.startsWith('Invalid transition')) return reply.code(409).send({ error: 'invalid_transition', message: error.message });
    if (error instanceof Error && (error.message.startsWith('Delivery state changed') || error.message.startsWith('Action is not available') || error.message.startsWith('Action prerequisites'))) return reply.code(409).send({ error: 'stale_or_ineligible_action', message: error.message });
    if (error instanceof Error && (/Sprint|Product Backlog Item|Definition of Done|same Product/.test(error.message))) return reply.code(409).send({ error: 'scrum_constraint', message: error.message });
    if (error instanceof Error && error.message.includes('proposal revision has already been decided')) return reply.code(409).send({ error: 'proposal_already_decided', message: error.message });
    if (error instanceof Error && (/BMAD|Story|stories\.yaml|Epic cannot|human approval|delivery route|Delivery Case/.test(error.message))) return reply.code(409).send({ error: 'delivery_constraint', message: error.message });
    return reply.code(500).send({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unexpected MIC error' });
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/system/responsibilities', async () => runtimeResponsibilities);
  app.get('/system/status', async () => {
    const [memory, [projectCount], [workItemCount], [activeRuns], [activeSessions], [pendingOutbox]] = await Promise.all([
      localMemory(), db.select({ value: count() }).from(projects), db.select({ value: count() }).from(workItems), db.select({ value: count() }).from(runs).where(eq(runs.status, 'RUNNING')), db.select({ value: count() }).from(workflowSessions).where(eq(workflowSessions.status, 'RUNNING')), db.select({ value: count() }).from(outboxEvents).where(isNull(outboxEvents.deliveredAt)),
    ]);
    let router: Record<string, unknown> = { status: 'unavailable' };
    try { router = await (await fetch('http://127.0.0.1:10000/health', { signal: AbortSignal.timeout(1000) })).json() as Record<string, unknown>; } catch {}
    return { status: 'ok', database: 'connected', router, memory, deployment: { mode: webSecurity.mode, publicOrigin: webSecurity.mode === 'remote' ? webSecurity.publicOrigin : undefined }, model: { configured: process.env.MIC_MODEL ?? 'llama.cpp/gpt-oss-120b-F16', provider: 'local llama.cpp' }, counts: { projects: projectCount.value, workItems: workItemCount.value, activeRuns: activeRuns.value + activeSessions.value, activeWorkflowSessions: activeSessions.value, pendingOutbox: pendingOutbox.value } };
  });
  app.post('/projects', async (request, reply) => reply.code(201).send(await kernel.createProject(projectInput.parse(request.body), key(request), requestActor(request))));
  app.post('/projects/:id/repositories', async (request, reply) => {
    const { id: projectId } = z.object({ id }).parse(request.params);
    const repository = await kernel.createRepository({ projectId, ...repositoryInput.parse(request.body) }, key(request), requestActor(request));
    await catalog.sync(repository.id);
    return reply.code(201).send(repository);
  });
  app.post('/work-items', async (request, reply) => reply.code(201).send(await kernel.createWorkItem(workItemInput.parse(request.body), key(request), requestActor(request))));
  app.post('/runs', async (request, reply) => reply.code(201).send(await kernel.createRun(runInput.parse(request.body), key(request), requestActor(request))));
  app.post('/questions', async (request, reply) => reply.code(201).send(await kernel.createQuestion(questionInput.parse(request.body), key(request), requestActor(request))));
  app.get('/projects', async () => db.select().from(projects).orderBy(desc(projects.createdAt)));
  app.get('/products', async (request, reply) => isBrowserDocumentRequest(request) && existsSync(frontend) ? reply.sendFile('index.html') : products.portfolio(id => delivery.get(id)));
  app.post('/products', async (request, reply) => {
    const body = projectInput.extend({ productGoal: z.string().trim().min(1).optional() }).parse(request.body);
    const product = await kernel.createProject(body, key(request), requestActor(request));
    if (body.productGoal) await products.createGoal(product.id, body.productGoal, 'active');
    return reply.code(201).send(await products.getByReference(product.id));
  });
  app.get('/products/:reference', async (request, reply) => {
    if (isBrowserDocumentRequest(request) && existsSync(frontend)) return reply.sendFile('index.html');
    const { reference } = z.object({ reference: id }).parse(request.params);
    const product = await products.getByReference(reference);
    if (!product) return reply.code(404).send({ error: 'not_found' });
    const [goals, productFeatures, productEpics, productRepositories, deliveries] = await Promise.all([
      products.goals(product.id), products.features(product.id), products.epics(product.id), db.select().from(repositories).where(eq(repositories.projectId, product.id)), streams.list(product.id),
    ]);
    return { product, goals, features: productFeatures, epics: productEpics, repositories: productRepositories, deliveries };
  });
  app.get('/products/:reference/roadmap', async (request, reply) => { if (isBrowserDocumentRequest(request) && existsSync(frontend)) return reply.sendFile('index.html'); const { reference } = z.object({ reference: id }).parse(request.params); const product = await products.getByReference(reference); return product ? products.roadmap(product.id) : reply.code(404).send({ error: 'not_found' }); });
  app.post('/products/:id/goals', async (request, reply) => { const { id: projectId } = z.object({ id }).parse(request.params); const body = z.object({ statement: z.string().trim().min(1), status: z.enum(['proposed', 'active']).default('proposed') }).parse(request.body); return reply.code(201).send(await products.createGoal(projectId, body.statement, body.status)); });
  app.post('/product-goals/:id/status', async request => { const { id: goalId } = z.object({ id }).parse(request.params); const { status } = z.object({ status: z.enum(['proposed', 'active', 'achieved', 'abandoned']) }).parse(request.body); return products.setGoalStatus(goalId, status); });
  app.post('/products/:id/features', async (request, reply) => { const { id: projectId } = z.object({ id }).parse(request.params); const body = z.object({ name: z.string().trim().min(1), description: z.string().optional(), status: z.enum(['proposed', 'active', 'deprecated', 'retired']).optional() }).parse(request.body); return reply.code(201).send(await products.createFeature(projectId, body)); });
  app.patch('/features/:id', async request => { const { id: featureId } = z.object({ id }).parse(request.params); const body = z.object({ name: z.string().trim().min(1).optional(), description: z.string().optional(), status: z.enum(['proposed', 'active', 'deprecated', 'retired']).optional() }).parse(request.body); return products.updateFeature(featureId, body); });
  app.post('/products/:id/epics', async (request, reply) => { const { id: projectId } = z.object({ id }).parse(request.params); const body = z.object({ name: z.string().trim().min(1), outcome: z.string().optional(), status: z.enum(['proposed', 'active', 'achieved', 'retired']).optional(), featureIds: z.array(id).optional() }).parse(request.body); return reply.code(201).send(await products.createEpic(projectId, body)); });
  app.patch('/product-epics/:id', async request => { const { id: epicId } = z.object({ id }).parse(request.params); const body = z.object({ name: z.string().trim().min(1).optional(), outcome: z.string().optional(), status: z.enum(['proposed', 'active', 'achieved', 'retired']).optional() }).parse(request.body); return products.updateEpic(epicId, body); });
  app.post('/product-goals/:id/features', async request => { const { id: goalId } = z.object({ id }).parse(request.params); const { featureId } = z.object({ featureId: id }).parse(request.body); return products.linkGoalFeature(goalId, featureId); });
  app.post('/product-epics/:id/features', async request => { const { id: epicId } = z.object({ id }).parse(request.params); const { featureId } = z.object({ featureId: id }).parse(request.body); return products.linkEpicFeature(epicId, featureId); });
  app.post('/features/:id/deliveries', async (request, reply) => { const { id: featureId } = z.object({ id }).parse(request.params); const { workstreamId } = z.object({ workstreamId: id }).parse(request.body); return reply.code(201).send(await products.linkFeature(featureId, workstreamId)); });
  app.post('/products/:id/definition-of-done', async request => { const { id: projectId } = z.object({ id }).parse(request.params); const { definitionOfDone } = z.object({ definitionOfDone: z.string().trim().min(1) }).parse(request.body); return products.updateDefinitionOfDone(projectId, definitionOfDone); });
  app.patch('/products/:id', async request => { const { id: projectId } = z.object({ id }).parse(request.params); const body = projectInput.partial().parse(request.body); return products.updateProduct(projectId, body); });
  app.get('/products/:id/briefs', async (request, reply) => { if (isBrowserDocumentRequest(request) && existsSync(frontend)) return reply.sendFile('index.html'); const { id: projectId } = z.object({ id }).parse(request.params); const briefs = await proposals.listBriefs(projectId); return Promise.all(briefs.map(async brief => ({ brief, proposals: await proposals.listProposals(brief.id) }))); });
  app.post('/products/:id/briefs', async (request, reply) => { const { id: projectId } = z.object({ id }).parse(request.params); const body = z.object({ title: z.string().trim().min(1), content: z.string().trim().min(1) }).parse(request.body); return reply.code(201).send(await proposals.createBrief(projectId, body.title, body.content, requestActor(request))); });
  app.post('/briefs/:id/analyse', async request => { const { id: briefId } = z.object({ id }).parse(request.params); const { feedback } = z.object({ feedback: z.string().trim().min(1).optional() }).parse(request.body); return proposals.analyse(briefId, feedback); });
  app.post('/product-proposals/:id/decisions', async request => { const { id: proposalId } = z.object({ id }).parse(request.params); const body = z.object({ kind: z.enum(['accepted', 'revision-requested', 'rejected']), actor: z.string().trim().min(1), feedback: z.string().trim().min(1).optional() }).parse(request.body); return proposals.decide(proposalId, body.kind, body.actor, body.feedback); });
  app.get('/product-epics/:id/delivery-recommendation', async request => { const { id: epicId } = z.object({ id }).parse(request.params); const { repositoryId } = z.object({ repositoryId: id.optional() }).parse(request.query); return routing.describeForEpic(epicId, repositoryId); });
  app.post('/product-epics/:id/dispatch', async (request, reply) => { const { id: epicId } = z.object({ id }).parse(request.params); const body = z.object({ repositoryId: id, path: z.enum(['spec-epic', 'project']).optional(), actor: id.optional() }).parse(request.body); return reply.code(201).send(await routing.dispatchEpic(epicId, body.repositoryId, body.path, body.actor)); });
  app.get('/product-backlog', async request => { const { projectId } = z.object({ projectId: id }).parse(request.query); return scrum.listBacklog(projectId); });
  app.post('/product-backlog', async (request, reply) => { const body = z.object({ projectId: id, featureId: id.optional(), epicId: id.optional(), workstreamId: id.optional(), storyUnitId: id.optional(), kind: z.enum(['story', 'defect', 'discovery']), title: z.string().trim().min(1), value: z.string().trim().min(1), description: z.string().optional(), order: z.number().int().optional(), acceptanceCriteria: z.array(z.string().trim().min(1)).optional(), acceptanceSignal: z.string().optional(), dependencies: z.array(z.string()).optional() }).parse(request.body); return reply.code(201).send(await scrum.createBacklogItem(body)); });
  app.get('/product-backlog/:reference', async (request, reply) => { const { reference } = z.object({ reference: id }).parse(request.params); const row = await scrum.getBacklogItem(reference); return row ?? reply.code(404).send({ error: 'not_found' }); });
  app.get('/product-backlog/:id/trace', async request => { const { id: itemId } = z.object({ id }).parse(request.params); return trace.backlogItem(itemId); });
  app.patch('/product-backlog/:id', async request => { const { id: itemId } = z.object({ id }).parse(request.params); const body = z.object({ featureId: id.nullable().optional(), epicId: id.nullable().optional(), title: z.string().trim().min(1).optional(), value: z.string().trim().min(1).optional(), description: z.string().optional(), acceptanceCriteria: z.array(z.string().trim().min(1)).optional(), acceptanceSignal: z.string().optional(), dependencies: z.array(z.string()).optional() }).parse(request.body); return scrum.updateBacklogItem(itemId, body); });
  app.put('/products/:id/backlog-order', async request => { const { id: projectId } = z.object({ id }).parse(request.params); const { itemIds } = z.object({ itemIds: z.array(id) }).parse(request.body); return scrum.reorderBacklog(projectId, itemIds); });
  app.post('/product-backlog/:id/status', async request => { const { id: itemId } = z.object({ id }).parse(request.params); const { status } = z.object({ status: z.enum(['proposed', 'ready', 'in-progress', 'review', 'blocked', 'done', 'removed']) }).parse(request.body); return scrum.updateBacklogStatus(itemId, status); });
  app.get('/product-backlog/:id/delivery-recommendation', async request => { const { id: itemId } = z.object({ id }).parse(request.params); const { repositoryId } = z.object({ repositoryId: id.optional() }).parse(request.query); return routing.describeForItem(itemId, repositoryId); });
  app.post('/product-backlog/:id/dispatch', async (request, reply) => { const { id: itemId } = z.object({ id }).parse(request.params); const body = z.object({ repositoryId: id, actor: id.optional() }).parse(request.body); return reply.code(201).send(await routing.prepareItemBuild(itemId, body.repositoryId, body.actor)); });
  app.get('/scrum-sprints', async request => { const { projectId } = z.object({ projectId: id }).parse(request.query); return scrum.listSprints(projectId); });
  app.post('/scrum-sprints', async (request, reply) => { const body = z.object({ projectId: id, number: z.number().int().positive(), goal: z.string().trim().min(1), startsAt: z.coerce.date(), endsAt: z.coerce.date() }).parse(request.body); return reply.code(201).send(await scrum.createSprint(body)); });
  app.post('/scrum-sprints/:id/items', async request => { const { id: sprintId } = z.object({ id }).parse(request.params); const { backlogItemId } = z.object({ backlogItemId: id }).parse(request.body); return scrum.selectItem(sprintId, backlogItemId); });
  app.delete('/scrum-sprints/:id/items/:itemId', async request => { const { id: sprintId, itemId } = z.object({ id, itemId: id }).parse(request.params); return scrum.removeItem(sprintId, itemId); });
  app.post('/scrum-sprints/:id/status', async request => { const { id: sprintId } = z.object({ id }).parse(request.params); const { status } = z.object({ status: z.enum(['planned', 'active', 'completed', 'cancelled']) }).parse(request.body); return scrum.setSprintStatus(sprintId, status); });
  app.put('/scrum-sprints/:id/review', async request => { const { id: sprintId } = z.object({ id }).parse(request.params); const body = z.object({ summary: z.string().trim().min(1), stakeholderFeedback: z.string().optional() }).parse(request.body); return scrum.recordReview(sprintId, body.summary, body.stakeholderFeedback); });
  app.put('/scrum-sprints/:id/retrospective', async request => { const { id: sprintId } = z.object({ id }).parse(request.params); const body = z.object({ insight: z.string().trim().min(1), adaptation: z.string().trim().min(1) }).parse(request.body); return scrum.recordRetrospective(sprintId, body.insight, body.adaptation); });
  app.get('/increments', async request => { const { projectId } = z.object({ projectId: id }).parse(request.query); return scrum.listIncrements(projectId); });
  app.post('/increments', async (request, reply) => { const body = z.object({ projectId: id, sprintId: id.optional(), title: z.string().trim().min(1), description: z.string().optional(), evidence: z.record(z.string(), z.unknown()).optional() }).parse(request.body); return reply.code(201).send(await scrum.createIncrement(body)); });
  app.get('/products/:id/activity', async (request, reply) => {
    if (isBrowserDocumentRequest(request) && existsSync(frontend)) return reply.sendFile('index.html');
    const { id: projectId } = z.object({ id }).parse(request.params);
    const productStreams = await streams.list(projectId); const streamIds = new Set(productStreams.map(row => row.id));
    const events = await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt));
    return events.filter(event => event.aggregateId === projectId || streamIds.has(event.aggregateId)).slice(0, 100);
  });
  app.get('/repositories', async request => { const query = z.object({ projectId: id.optional() }).parse(request.query); return query.projectId ? db.select().from(repositories).where(eq(repositories.projectId, query.projectId)) : db.select().from(repositories); });
  app.get('/repositories/:id/git-health', async (request, reply) => { const { id: repositoryId } = z.object({ id }).parse(request.params); const [repository] = await db.select().from(repositories).where(eq(repositories.id, repositoryId)); return repository ? repositoryHealth(repository.path, repository.baseBranch) : reply.code(404).send({ error: 'not_found' }); });
  app.get('/work-items', async request => { const query = z.object({ projectId: id.optional() }).parse(request.query); return query.projectId ? db.select().from(workItems).where(eq(workItems.projectId, query.projectId)).orderBy(desc(workItems.createdAt)) : db.select().from(workItems).orderBy(desc(workItems.createdAt)); });
  app.get('/runs', async request => { const query = z.object({ workItemId: id.optional() }).parse(request.query); return query.workItemId ? db.select().from(runs).where(eq(runs.workItemId, query.workItemId)).orderBy(desc(runs.createdAt)) : db.select().from(runs).orderBy(desc(runs.createdAt)); });
  app.get('/questions', async request => { const query = z.object({ status: id.optional(), workItemId: id.optional() }).parse(request.query); const clauses = [query.status ? eq(questions.status, query.status) : undefined, query.workItemId ? eq(questions.workItemId, query.workItemId) : undefined].filter(Boolean) as any[]; return db.select().from(questions).where(clauses.length ? and(...clauses) : undefined).orderBy(desc(questions.createdAt)); });
  app.get('/approvals', async request => { const query = z.object({ workItemId: id.optional() }).parse(request.query); return query.workItemId ? db.select().from(approvals).where(eq(approvals.workItemId, query.workItemId)).orderBy(desc(approvals.createdAt)) : db.select().from(approvals).orderBy(desc(approvals.createdAt)); });
  app.post('/repositories/:id/bmad/refresh', async request => { const { id: repositoryId } = z.object({ id }).parse(request.params); return catalog.sync(repositoryId); });
  app.get('/repositories/:id/bmad', async request => { const { id: repositoryId } = z.object({ id }).parse(request.params); return catalog.list(repositoryId); });
  app.get('/repositories/:id/bmad/health', async request => { const { id: repositoryId } = z.object({ id }).parse(request.params); return catalog.health(repositoryId); });
  app.post('/workstreams', async (request, reply) => { const body = z.object({ projectId: id, repositoryId: id.optional(), legacyWorkItemId: id.optional(), title: z.string().min(1), intent: z.string().min(1), path: z.enum(['undecided', 'direct', 'spec-epic', 'project', 'specialist']).default('undecided') }).parse(request.body); return reply.code(201).send(await streams.create(body, key(request), requestActor(request))); });
  app.get('/workstreams', async request => { const query = z.object({ projectId: id.optional() }).parse(request.query); return streams.list(query.projectId); });
  app.get('/deliveries/:reference', async (request, reply) => { const { reference } = z.object({ reference: id }).parse(request.params); const query = z.object({ projectId: id.optional() }).parse(request.query); const stream = await streams.getByReference(reference, query.projectId); return stream ? delivery.get(stream.id) : reply.code(404).send({ error: 'not_found' }); });
  app.get('/workstreams/:id/lifecycle', async request => { const { id: workstreamId } = z.object({ id }).parse(request.params); return delivery.get(workstreamId); });
  app.post('/workstreams/:id/actions/:actionId/validate', async request => { const { id: workstreamId, actionId } = z.object({ id, actionId: id }).parse(request.params); const { actionToken } = z.object({ actionToken: id }).parse(request.body); return delivery.validate(workstreamId, actionId, actionToken); });
  app.post('/workstreams/:id/path', async request => { const { id: workstreamId } = z.object({ id }).parse(request.params); const body = z.object({ path: z.enum(['direct', 'spec-epic', 'project', 'specialist']), actor: id.optional() }).parse(request.body); return streams.selectPath(workstreamId, body.path, body.actor); });
  app.get('/workstreams/:id/operations', async request => { const { id: workstreamId } = z.object({ id }).parse(request.params); return streams.operations(workstreamId); });
  app.post('/workflow-sessions', async (request, reply) => { const body = z.object({ workstreamId: id, storyUnitId: id.optional(), skill: id, action: id.optional(), args: z.record(z.string(), z.unknown()).optional(), prompt: z.string().min(1) }).parse(request.body); return reply.code(202).send(await sessions.start(body, requestActor(request))); });
  app.get('/workflow-sessions', async request => { const query = z.object({ workstreamId: id.optional() }).parse(request.query); return sessions.list(query.workstreamId); });
  app.get('/workflow-sessions/:id', async (request, reply) => { const { id: sessionId } = z.object({ id }).parse(request.params); const [session] = await db.select().from(workflowSessions).where(eq(workflowSessions.id, sessionId)); return session ? reply.send({ ...session, turns: await sessions.turns(sessionId) }) : reply.code(404).send({ error: 'not_found' }); });
  app.post('/workflow-sessions/:id/respond', async request => { const { id: sessionId } = z.object({ id }).parse(request.params); const body = z.object({ content: z.string().trim().min(1), actor: id.optional() }).parse(request.body); return sessions.respond(sessionId, body.content, body.actor, key(request)); });
  app.post('/workflow-sessions/:id/revise', async request => { const { id: sessionId } = z.object({ id }).parse(request.params); const body = z.object({ content: z.string().trim().min(1), actor: id.optional() }).parse(request.body); return sessions.revise(sessionId, body.content, body.actor, key(request)); });
  app.post('/workflow-sessions/:id/classify', async request => { const { id: sessionId } = z.object({ id }).parse(request.params); const body = z.object({ classification: z.enum(['waiting', 'finished']), actor: id.optional() }).parse(request.body); return sessions.classify(sessionId, body.classification, body.actor); });
  app.post('/workflow-sessions/:id/pause', async request => { const { id: sessionId } = z.object({ id }).parse(request.params); const body = z.object({ actor: id.optional() }).parse(request.body ?? {}); return sessions.pause(sessionId, body.actor); });
  app.post('/workflow-sessions/:id/resume', async request => { const { id: sessionId } = z.object({ id }).parse(request.params); const body = z.object({ actor: id.optional() }).parse(request.body ?? {}); return sessions.resume(sessionId, body.actor, key(request)); });
  app.post('/workflow-sessions/:id/cancel', async request => { const { id: sessionId } = z.object({ id }).parse(request.params); const body = z.object({ actor: id.optional() }).parse(request.body ?? {}); return sessions.cancel(sessionId, body.actor); });
  app.get('/workflow-sessions/:id/events', async (request, reply) => {
    const { id: sessionId } = z.object({ id }).parse(request.params);
    reply.hijack(); reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const emit = (event: unknown) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    emit({ type: 'connected', sessionId }); sessions.events.on(sessionId, emit);
    const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15_000);
    request.raw.on('close', () => { clearInterval(heartbeat); sessions.events.off(sessionId, emit); });
  });
  app.post('/workstreams/:id/artifacts/index', async request => { const { id: workstreamId } = z.object({ id }).parse(request.params); const body = z.object({ sessionId: id.optional() }).parse(request.body ?? {}); return artifacts.index(workstreamId, body.sessionId); });
  app.get('/artifacts', async request => { const query = z.object({ workstreamId: id }).parse(request.query); return artifacts.list(query.workstreamId); });
  app.get('/artifacts/:id', async (request, reply) => { const { id: artifactId } = z.object({ id }).parse(request.params); const [artifact] = await db.select().from(artifactRevisions).where(eq(artifactRevisions.id, artifactId)); return artifact ? reply.send(artifact) : reply.code(404).send({ error: 'not_found' }); });
  app.get('/artifacts/:id/reviews', async request => { const { id: artifactId } = z.object({ id }).parse(request.params); return db.select().from(reviewDecisions).where(eq(reviewDecisions.artifactRevisionId, artifactId)).orderBy(desc(reviewDecisions.createdAt)); });
  app.get('/artifacts/:id/download', async (request, reply) => { const { id: artifactId } = z.object({ id }).parse(request.params); const [artifact] = await db.select().from(artifactRevisions).where(eq(artifactRevisions.id, artifactId)); return artifact ? reply.header('content-disposition', `attachment; filename="${artifact.path.split('/').at(-1)}"`).type('text/plain').send(artifact.content) : reply.code(404).send({ error: 'not_found' }); });
  app.get('/workstreams/:id/artifact-graph', async request => { const { id: workstreamId } = z.object({ id }).parse(request.params); return artifacts.graph(workstreamId); });
  app.get('/artifact-diff', async request => { const query = z.object({ from: id, to: id }).parse(request.query); return artifacts.diff(query.from, query.to); });
  app.post('/artifacts/:id/reviews', async (request, reply) => {
    const { id: artifactId } = z.object({ id }).parse(request.params);
    const body = z.object({ kind: z.enum(['accepted', 'rejected', 'feedback', 'override']), feedback: z.string().trim().optional(), actor: id }).parse(request.body);
    const decision = await artifacts.review(artifactId, body);
    if (body.kind !== 'accepted') return decision;
    const [artifact] = await db.select().from(artifactRevisions).where(eq(artifactRevisions.id, artifactId));
    if (artifact?.type === 'story-inventory') return { decision, storyPlan: await stories.sync(artifact.workstreamId) };
    if (artifact?.type !== 'spec') return decision;
    const existing = await db.select().from(workflowSessions).where(and(eq(workflowSessions.workstreamId, artifact.workstreamId), eq(workflowSessions.skill, 'bmad-spec'), eq(workflowSessions.action, 'create-stories'))).orderBy(desc(workflowSessions.createdAt)).limit(1);
    if (existing.some(session => ['QUEUED', 'RESOURCE_WAITING', 'RUNNING', 'WAITING_FOR_INPUT', 'BLOCKED', 'PAUSED', 'INTERRUPTED', 'NEEDS_CLASSIFICATION', 'FINISHED'].includes(session.status))) return { decision, session: existing[0] };
    const session = await sessions.start({
      workstreamId: artifact.workstreamId,
      skill: 'bmad-spec',
      action: 'create-stories',
      args: { artifactPath: artifact.path, artifactRevisionId: artifact.id, artifactHash: artifact.contentHash, interactionMode: 'attended' },
      prompt: `Start BMAD Story Breakdown for the accepted specification ${artifact.path} at exact revision ${artifact.id} (${artifact.contentHash}). This is an attended BMAD conversation carried through MIC: ask for the human judgements required by Story Breakdown, preserve the session between replies, and produce stories.yaml only after those judgements are resolved.`,
    }, body.actor);
    return reply.code(202).send({ decision, session });
  });
  app.post('/artifacts/:id/feedback', async (request, reply) => {
    const { id: artifactId } = z.object({ id }).parse(request.params); const body = z.object({ feedback: z.string().trim().min(1), actor: id }).parse(request.body);
    const [artifact] = await db.select().from(artifactRevisions).where(eq(artifactRevisions.id, artifactId));
    if (!artifact?.sessionId) return reply.code(409).send({ error: 'owning_session_unavailable' });
    const [owner] = await db.select().from(workflowSessions).where(eq(workflowSessions.id, artifact.sessionId));
    if (!owner) return reply.code(409).send({ error: 'owning_session_unavailable' });
    const decision = await artifacts.review(artifactId, { kind: 'feedback', feedback: body.feedback, actor: body.actor });
    const session = await sessions.revise(owner.id, `Revise and validate ${artifact.path} from revision ${artifact.id}. Reviewer feedback:\n${body.feedback}`, body.actor, key(request));
    return reply.code(202).send({ decision, session });
  });
  app.get('/attention', async () => artifacts.attention());
  app.post('/workstreams/:id/stories/sync', async request => { const { id: workstreamId } = z.object({ id }).parse(request.params); return stories.sync(workstreamId); });
  app.get('/stories', async request => { const query = z.object({ workstreamId: id }).parse(request.query); return stories.list(query.workstreamId); });
  app.post('/stories/:id/dispatch', async (request, reply) => { const { id: storyId } = z.object({ id }).parse(request.params); const body = z.object({ skill: z.enum(['bmad-build', 'bmad-build-auto']), actor: id.optional() }).parse(request.body); const dispatch = await stories.dispatch(storyId, body.skill); return reply.code(202).send(await sessions.start(dispatch, body.actor)); });
  app.post('/stories/:id/status', async request => { const { id: storyId } = z.object({ id }).parse(request.params); const body = z.object({ status: z.enum(['backlog', 'ready-for-dev', 'in-progress', 'review', 'done', 'blocked']), evidence: z.record(z.string(), z.unknown()).default({}), actor: id }).parse(request.body); return stories.update(storyId, body.status, body.evidence, body.actor); });
  app.get('/workstreams/:id/retrospective-readiness', async request => { const { id: workstreamId } = z.object({ id }).parse(request.params); return stories.retrospectiveReady(workstreamId); });
  app.post('/workstreams/:id/integrate', async request => { const { id: workstreamId } = z.object({ id }).parse(request.params); const body = z.object({ actor: id, confirm: z.literal(true) }).parse(request.body); return stories.integrate(workstreamId, body.actor); });
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
      db.select().from(runs).where(eq(runs.workItemId, workItemId)).orderBy(desc(runs.createdAt)), db.select().from(questions).where(eq(questions.workItemId, workItemId)).orderBy(desc(questions.createdAt)), db.select().from(approvals).where(eq(approvals.workItemId, workItemId)), db.select().from(auditEvents).where(and(eq(auditEvents.aggregateType, 'work_item'), eq(auditEvents.aggregateId, workItemId))).orderBy(auditEvents.createdAt), db.select().from(planningArtifacts).where(eq(planningArtifacts.workItemId, workItemId)).orderBy(desc(planningArtifacts.createdAt)), db.select().from(implementationArtifacts).where(eq(implementationArtifacts.workItemId, workItemId)).orderBy(desc(implementationArtifacts.createdAt)),
    ]);
    return { item, runs: itemRuns, questions: itemQuestions, approvals: itemApprovals, timeline, artifacts: [...plans.map(value => ({ ...value, type: 'planning' })), ...implementations.map(value => ({ ...value, type: 'implementation' }))] };
  });
  app.get('/runs/:id/evidence', async request => { const { id: runId } = z.object({ id }).parse(request.params); return db.select().from(evidenceRecords).where(eq(evidenceRecords.runId, runId)); });
  app.get('/runs/:id/logs', async (request, reply) => { const { id: runId } = z.object({ id }).parse(request.params); const [run] = await db.select().from(runs).where(eq(runs.id, runId)); if (!run) return reply.code(404).send({ error: 'not_found' }); const raw = (run.result as any)?.rawAdapterState ?? {}; return { runId, stdout: raw.stdout ?? '', stderr: raw.stderr ?? '', startedAt: raw.startedAt, finishedAt: raw.finishedAt }; });
  app.get('/artifacts/:type/:id/content', async (request, reply) => { const params = z.object({ type: z.enum(['planning', 'implementation']), id }).parse(request.params); const table = params.type === 'planning' ? planningArtifacts : implementationArtifacts; const [artifact] = await db.select().from(table as any).where(eq((table as any).id, params.id)); if (!artifact) return reply.code(404).send({ error: 'not_found' }); const [run] = artifact.runId ? await db.select().from(runs).where(eq(runs.id, artifact.runId)) : []; const root = (run?.result as any)?.rawAdapterState?.worktree; if (!root) return reply.code(409).send({ error: 'artifact_unavailable' }); const path = resolve(root, artifact.path); if (path !== resolve(root) && !path.startsWith(resolve(root) + sep)) return reply.code(400).send({ error: 'invalid_artifact_path' }); return reply.type('text/plain').send(await readFile(path, 'utf8')); });
  app.post('/evidence', async (request, reply) => { const body = z.object({ runId: id, repositoryId: id, kind: z.enum(['BUILD_PASS', 'TESTS_PASS']), revision: id, passed: z.boolean(), data: z.unknown() }).parse(request.body); const [row] = await db.insert(evidenceRecords).values({ id: `evidence_${randomUUID()}`, ...body }).returning(); return reply.code(201).send(row); });
  app.get('/runs/:id/gates', async request => { const { id: runId } = z.object({ id }).parse(request.params); const [run] = await db.select().from(runs).where(eq(runs.id, runId)); if (!run) return null; const records = await db.select().from(evidenceRecords).where(eq(evidenceRecords.runId, runId)); return evaluateGates(run.resultRevision ?? '', records.map(row => ({ kind: row.kind, revision: row.revision, passed: row.passed, data: row.data }) as Evidence)); });
  app.post('/runs/:id/cancel', async (request, reply) => { const { id: runId } = z.object({ id }).parse(request.params); const [run] = await db.select().from(runs).where(eq(runs.id, runId)); if (!run) return reply.code(404).send({ error: 'not_found' }); if (!['RUNNING', 'QUEUED'].includes(run.status)) return reply.code(409).send({ error: 'run_not_active' }); const cancelled = executor?.cancel?.(runId) ?? false; if (!cancelled) return reply.code(409).send({ error: 'active_process_not_found' }); await db.update(runs).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(runs.id, runId)); return reply.send({ runId, cancelled }); });
  app.get('/resources', async () => ({ ...(await localMemory()), disk: await localDisk(), thresholds: { minimumAvailableMiB: 200, minimumAvailableFraction: 0.25, minimumDiskAvailableGiB: 20, swap: 'reported as telemetry' } }));
  app.get('/scheduler', async () => { const [[pending], [processed], [running], [waiting]] = await Promise.all([db.select({ value: count() }).from(outboxEvents).where(isNull(outboxEvents.deliveredAt)), db.select({ value: count() }).from(processedEvents), db.select({ value: count() }).from(workflowSessions).where(eq(workflowSessions.status, 'RUNNING')), db.select({ value: count() }).from(workflowSessions).where(eq(workflowSessions.status, 'RESOURCE_WAITING'))]); return { pendingOutbox: pending.value, processedEvents: processed.value, workflowSessions: { running: running.value, resourceWaiting: waiting.value }, mode: 'single-model', concurrency: 1 }; });
  const requireLifecycle = () => { if (!lifecycle) throw new Error('Lifecycle executor is not configured'); return lifecycle; };
  app.post('/work-items/:id/discovery', async request => { const { id: entityId } = z.object({ id }).parse(request.params); return requireLifecycle().runDiscovery(entityId, z.record(z.string(), z.unknown()).parse(request.body)); });
  app.post('/work-items/:id/planning', async request => { const { id: entityId } = z.object({ id }).parse(request.params); return requireLifecycle().runPlanning(entityId); });
  app.post('/work-items/:id/planning-feedback', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const body = z.object({ artifactHash: id, feedback: z.string().trim().min(1), actor: id }).parse(request.body); return requireLifecycle().recordPlanningFeedback(entityId, body.artifactHash, body.feedback, body.actor); });
  app.post('/work-items/:id/planning-approval', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const body = z.object({ artifactHash: id, approver: id }).parse(request.body); return requireLifecycle().recordPlanningApproval(entityId, body.artifactHash, body.approver); });
  app.post('/work-items/:id/technical-discovery', async request => { const { id: entityId } = z.object({ id }).parse(request.params); return requireLifecycle().runTechnicalDiscovery(entityId, z.record(z.string(), z.unknown()).parse(request.body)); });
  app.post('/work-items/:id/implementation', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const target = z.discriminatedUnion('type', [z.object({ type: z.literal('direct'), intent: z.string().min(1) }), z.object({ type: z.literal('spec'), path: z.string().min(1) }), z.object({ type: z.literal('story'), specFolder: z.string().min(1), storyId: z.string().min(1) })]).parse(request.body); return requireLifecycle().runImplementation(entityId, target); });
  app.post('/work-items/:id/implementation-approval', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const body = z.object({ artifactHash: id, approver: id }).parse(request.body); return requireLifecycle().recordImplementationApproval(entityId, body.artifactHash, body.approver); });
  app.post('/work-items/:id/pause', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const body = z.object({ reason: z.string().trim().min(1), actor: id }).parse(request.body); return requireLifecycle().pause(entityId, body.reason, body.actor); });
  app.post('/questions/:id/answer', async request => { const { id: entityId } = z.object({ id }).parse(request.params); const body = z.object({ answer: z.string().min(1), actor: id }).parse(request.body); return requireLifecycle().answerQuestion(entityId, body.answer, body.actor); });
  app.setNotFoundHandler((request, reply) => {
    if (isBrowserDocumentRequest(request) && existsSync(frontend)) return reply.sendFile('index.html');
    return reply.code(404).send({ error: 'not_found' });
  });
  return app;
}
