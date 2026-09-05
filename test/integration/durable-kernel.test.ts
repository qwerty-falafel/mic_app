import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { createApp } from '../../src/api.js';
import { createDatabase } from '../../src/db/client.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { approvals, auditEvents, implementationArtifacts, outboxEvents, planningArtifacts, processedEvents, questions, workItems } from '../../src/db/schema.js';
import { OutboxRuntime } from '../../src/dispatcher.js';
import { Kernel } from '../../src/kernel.js';
import { LifecycleService } from '../../src/services/lifecycle.js';

async function freePort() {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('No TCP port assigned'));
      server.close(() => resolvePort(address.port));
    });
  });
}

async function eventually(assertion: () => Promise<void>, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try { await assertion(); return; } catch (error) { lastError = error; }
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw lastError;
}

describe('durable MIC kernel', () => {
  let postgres: EmbeddedPostgres;
  let databaseUrl: string;
  let databaseDir: string;

  beforeAll(async () => {
    const port = await freePort();
    databaseDir = resolve('.runtime', `postgres-${process.pid}-${Date.now()}`);
    postgres = new EmbeddedPostgres({ databaseDir, port, user: 'postgres', password: 'mic-test', persistent: true, onLog: () => {}, onError: () => {} });
    await postgres.initialise();
    await postgres.start();
    databaseUrl = `postgres://postgres:mic-test@127.0.0.1:${port}/postgres`;
  }, 60_000);

  afterAll(async () => {
    await postgres?.stop();
    if (databaseDir && existsSync(databaseDir)) rmSync(databaseDir, { recursive: true, force: true });
  }, 30_000);

  it('persists state across restart and processes its outbox idempotently with audit', async () => {
    const first = createDatabase(databaseUrl);
    await migrateDatabase(first.db);
    const firstApp = createApp(first.db);

    const projectResponse = await firstApp.inject({ method: 'POST', url: '/projects', headers: { 'idempotency-key': 'acceptance-project' }, payload: { name: 'Acceptance project' } });
    expect(projectResponse.statusCode).toBe(201);
    const project = projectResponse.json<{ id: string }>();
    const command = { method: 'POST' as const, url: '/work-items', headers: { 'idempotency-key': 'acceptance-work-item' }, payload: { projectId: project.id, title: 'Survive restart', intent: 'Prove the durable kernel' } };
    const created = await firstApp.inject(command);
    const repeated = await firstApp.inject(command);
    expect(created.statusCode).toBe(201);
    expect(repeated.json()).toEqual(created.json());
    const workItem = created.json<{ id: string }>();
    const repository = (await firstApp.inject({ method: 'POST', url: `/projects/${project.id}/repositories`, headers: { 'idempotency-key': 'acceptance-repository' }, payload: { path: '/tmp/acceptance.git' } })).json<{ id: string }>();
    const run = (await firstApp.inject({ method: 'POST', url: '/runs', headers: { 'idempotency-key': 'acceptance-run' }, payload: { workItemId: workItem.id, kind: 'planning', baselineRevision: 'abc123' } })).json<{ id: string }>();
    const question = (await firstApp.inject({ method: 'POST', url: '/questions', headers: { 'idempotency-key': 'acceptance-question' }, payload: { workItemId: workItem.id, runId: run.id, question: 'Proceed?' } })).json<{ id: string }>();
    expect((await firstApp.inject({ method: 'GET', url: '/system/status' })).statusCode).toBe(200);
    expect((await firstApp.inject({ method: 'GET', url: '/projects' })).json()).toHaveLength(1);
    expect((await firstApp.inject({ method: 'GET', url: `/work-items/${workItem.id}/detail` })).json()).toMatchObject({ item: { id: workItem.id } });
    expect((await firstApp.inject({ method: 'GET', url: `/runs/${run.id}/logs` })).json()).toMatchObject({ runId: run.id, stdout: '', stderr: '' });
    expect((await firstApp.inject({ method: 'GET', url: `/runs/${run.id}/gates` })).json()).toMatchObject({ passed: false });
    expect((await firstApp.inject({ method: 'GET', url: '/resources' })).statusCode).toBe(200);
    expect((await firstApp.inject({ method: 'GET', url: '/scheduler' })).statusCode).toBe(200);

    await firstApp.close();
    await first.pool.end();

    // A new pool and application instance model a MIC process restart.
    const second = createDatabase(databaseUrl);
    const secondApp = createApp(second.db);
    const persisted = await secondApp.inject({ method: 'GET', url: `/work-items/${workItem.id}` });
    expect(persisted.statusCode).toBe(200);
    expect(persisted.json()).toMatchObject({ id: workItem.id, state: 'INTAKE' });
    for (const [path, entityId] of [['projects', project.id], ['repositories', repository.id], ['runs', run.id], ['questions', question.id]]) {
      expect((await secondApp.inject({ method: 'GET', url: `/${path}/${entityId}` })).statusCode).toBe(200);
    }

    const runtime = new OutboxRuntime(second.db, databaseUrl);
    await runtime.start();
    try {
      const [workItemOutbox] = await second.db.select().from(outboxEvents).where(eq(outboxEvents.idempotencyKey, 'work_item:acceptance-work-item:outbox'));
      await runtime.dispatchBatch();
      await eventually(async () => {
        const processed = await second.db.select().from(processedEvents).where(eq(processedEvents.outboxEventId, workItemOutbox!.id));
        expect(processed).toHaveLength(1);
      });

      const [delivered] = await second.db.select().from(outboxEvents).where(eq(outboxEvents.id, workItemOutbox!.id));
      expect(delivered?.deliveredAt).toBeInstanceOf(Date);
      await second.db.execute(sql`UPDATE outbox_events SET delivered_at = NULL WHERE id = ${workItemOutbox!.id}`);
      await runtime.dispatchBatch();
      await eventually(async () => {
        const processed = await second.db.select().from(processedEvents).where(eq(processedEvents.outboxEventId, workItemOutbox!.id));
        expect(processed).toHaveLength(1);
      });

      expect(await second.db.select().from(workItems).where(eq(workItems.commandKey, 'acceptance-work-item'))).toHaveLength(1);
      expect(await second.db.select().from(auditEvents).where(eq(auditEvents.idempotencyKey, 'work_item:acceptance-work-item:audit'))).toHaveLength(1);
      expect(await second.db.select().from(outboxEvents).where(eq(outboxEvents.idempotencyKey, 'work_item:acceptance-work-item:outbox'))).toHaveLength(1);
    } finally {
      await runtime.stop();
      await secondApp.close();
      await second.pool.end();
    }
  }, 60_000);

  it('moves an intent through revision-bound planning and implementation approvals to DONE', async () => {
    const connection = createDatabase(databaseUrl);
    const kernel = new Kernel(connection.db);
    const project = await kernel.createProject({ name: 'Lifecycle project' }, 'lifecycle-project');
    const execute = async ({ mode, runId }: { mode: 'planning' | 'implementation'; runId: string }) => ({
      runId, status: 'done' as const, artifactRefs: [`artifacts/${mode}.md`], evidenceRefs: mode === 'implementation' ? ['evidence/tests.log'] : [],
      repositoryRevisions: { baseline: '1111111', result: mode === 'planning' ? '2222222' : '3333333' }, summary: `${mode} complete`, rawAdapterState: {},
    });
    const lifecycle = new LifecycleService(connection.db, { execute });
    try {
      const item = await lifecycle.intake(project.id, 'Build the vertical slice', 'Vertical slice', 'lifecycle-work-item');
      await lifecycle.runDiscovery(item.id, { repositories: [project.id] });
      const planned = await lifecycle.runPlanning(item.id);
      if (!('artifactHash' in planned)) throw new Error('Planning unexpectedly blocked');
      await lifecycle.recordPlanningApproval(item.id, planned.artifactHash, 'Michael');
      await lifecycle.runTechnicalDiscovery(item.id, { risks: [] });
      const implemented = await lifecycle.runImplementation(item.id);
      if (!('artifactHash' in implemented)) throw new Error('Implementation unexpectedly blocked');
      const done = await lifecycle.recordImplementationApproval(item.id, implemented.artifactHash, 'Michael');

      expect(done.state).toBe('DONE');
      expect(await connection.db.select().from(planningArtifacts).where(eq(planningArtifacts.workItemId, item.id))).toHaveLength(1);
      expect(await connection.db.select().from(implementationArtifacts).where(eq(implementationArtifacts.workItemId, item.id))).toHaveLength(1);
      expect(await connection.db.select().from(approvals).where(eq(approvals.workItemId, item.id))).toHaveLength(2);
      await expect(lifecycle.runDiscovery(item.id, {})).rejects.toThrow('Invalid transition');
    } finally { await connection.pool.end(); }
  }, 30_000);

  it('persists a blocked adapter result as a resumable question', async () => {
    const connection = createDatabase(databaseUrl);
    const kernel = new Kernel(connection.db);
    const project = await kernel.createProject({ name: 'Blocked project' }, 'blocked-project');
    const lifecycle = new LifecycleService(connection.db, { execute: async ({ runId }) => ({ runId, status: 'blocked', artifactRefs: [], evidenceRefs: [], repositoryRevisions: { baseline: 'aaaaaaa', result: 'aaaaaaa' }, blockingCondition: { code: 'no_subagents', message: 'Build Auto requires subagents' }, summary: 'blocked', rawAdapterState: {} }) });
    try {
      const item = await lifecycle.intake(project.id, 'Exercise blocked routing', 'Blocked route', 'blocked-work-item');
      await lifecycle.runDiscovery(item.id, {});
      const result = await lifecycle.runPlanning(item.id);
      expect('blocked' in result && result.blocked).toBe(true);
      const [question] = await connection.db.select().from(questions).where(eq(questions.workItemId, item.id));
      expect(question).toMatchObject({ status: 'OPEN', question: 'Build Auto requires subagents' });
      const resumed = await lifecycle.answerQuestion(question!.id, 'Use the supported path', 'Michael');
      expect(resumed.state).toBe('PLANNING_GRADE');
    } finally { await connection.pool.end(); }
  }, 30_000);
});
