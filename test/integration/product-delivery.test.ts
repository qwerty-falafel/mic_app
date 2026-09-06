import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { createServer } from 'node:net';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../../src/api.js';
import { createDatabase } from '../../src/db/client.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { artifactRevisions, reviewDecisions } from '../../src/db/schema.js';

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

describe('product model and delivery lifecycle projection', () => {
  let postgres: EmbeddedPostgres;
  let databaseDir: string;
  let connection: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const port = await freePort();
    databaseDir = resolve('.runtime', `product-postgres-${process.pid}-${Date.now()}`);
    postgres = new EmbeddedPostgres({ databaseDir, port, user: 'postgres', password: 'mic-test', persistent: true, onLog: () => {}, onError: () => {} });
    await postgres.initialise();
    await postgres.start();
    connection = createDatabase(`postgres://postgres:mic-test@127.0.0.1:${port}/postgres`);
    await migrateDatabase(connection.db);
    app = createApp(connection.db);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    await postgres?.stop();
    if (databaseDir && existsSync(databaseDir)) rmSync(databaseDir, { recursive: true, force: true });
  }, 30_000);

  it('keeps one active Product Goal and persistent Features around delivery', async () => {
    const productResponse = await app.inject({ method: 'POST', url: '/projects', headers: { 'idempotency-key': 'product-model' }, payload: { name: 'TTS Application' } });
    expect(productResponse.statusCode).toBe(201);
    const product = productResponse.json<any>();
    expect(product.slug).toMatch(/^tts-application-/);
    expect(product.definitionOfDone).toContain('usable');

    const firstGoal = (await app.inject({ method: 'POST', url: `/products/${product.id}/goals`, payload: { statement: 'First goal', status: 'active' } })).json<any>();
    const secondGoal = (await app.inject({ method: 'POST', url: `/products/${product.id}/goals`, payload: { statement: 'Enable comfortable long-form listening', status: 'active' } })).json<any>();
    expect(firstGoal.status).toBe('active');
    expect(secondGoal.status).toBe('active');

    const feature = (await app.inject({ method: 'POST', url: `/products/${product.id}/features`, payload: { name: 'Long-form TTS playback' } })).json<any>();
    const delivery = (await app.inject({ method: 'POST', url: '/workstreams', headers: { 'idempotency-key': 'tts-delivery' }, payload: { projectId: product.id, title: 'Build reliable playback', intent: 'Stream long text through bounded chunks.', path: 'spec-epic' } })).json<any>();
    await app.inject({ method: 'POST', url: `/features/${feature.id}/deliveries`, payload: { workstreamId: delivery.id } });

    const overview = (await app.inject({ method: 'GET', url: `/products/${product.slug}` })).json<any>();
    expect(overview.goals).toEqual(expect.arrayContaining([expect.objectContaining({ id: firstGoal.id, status: 'abandoned' }), expect.objectContaining({ id: secondGoal.id, status: 'active' })]));
    expect(overview.features).toEqual([expect.objectContaining({ id: feature.id, status: 'active' })]);
    expect(overview.deliveries).toEqual([expect.objectContaining({ id: delivery.id, classification: 'epic', intent: 'Stream long text through bounded chunks.' })]);

    const initial = (await app.inject({ method: 'GET', url: `/workstreams/${delivery.id}/lifecycle` })).json<any>();
    expect(initial).toMatchObject({ delivery: { classification: 'epic', brief: 'Stream long text through bounded chunks.' }, currentStage: { id: 'specification', state: 'ready' }, recommendedAction: { id: 'create-specification' } });
    expect(initial.alternativeActions).toContainEqual(expect.objectContaining({ id: 'index-stories', eligible: false, reason: expect.stringContaining('stories.yaml') }));

    const [spec] = await connection.db.insert(artifactRevisions).values({ id: 'artifact_spec', workstreamId: delivery.id, path: '_bmad-output/specs/tts/SPEC.md', type: 'spec', status: 'ready-for-dev', contentHash: 'spec-hash', content: '# Spec', metadata: { valid: true } }).returning();
    const review = (await app.inject({ method: 'GET', url: `/deliveries/${delivery.slug}?projectId=${product.id}` })).json<any>();
    expect(review).toMatchObject({ currentStage: { id: 'specification', state: 'awaiting-decision' }, attention: { type: 'artifact', id: spec!.id }, recommendedAction: { id: 'review-artifact' } });

    await connection.db.insert(reviewDecisions).values({ id: 'review_accept', artifactRevisionId: spec!.id, kind: 'accepted', actor: 'Michael' });
    const breakdown = (await app.inject({ method: 'GET', url: `/workstreams/${delivery.id}/lifecycle` })).json<any>();
    expect(breakdown).toMatchObject({ currentStage: { id: 'story-plan', state: 'ready' }, recommendedAction: { id: 'create-story-plan' } });

    const stale = await app.inject({ method: 'POST', url: `/workstreams/${delivery.id}/actions/create-story-plan/validate`, payload: { actionToken: initial.actionToken } });
    expect(stale.statusCode).toBe(409);
    const valid = await app.inject({ method: 'POST', url: `/workstreams/${delivery.id}/actions/create-story-plan/validate`, payload: { actionToken: breakdown.actionToken } });
    expect(valid.statusCode).toBe(200);

    const backlogItem = (await app.inject({ method: 'POST', url: '/product-backlog', payload: { projectId: product.id, featureId: feature.id, workstreamId: delivery.id, kind: 'epic', title: 'Long-form playback', acceptanceCriteria: ['Reads beyond 5,000 characters'] } })).json<any>();
    expect((await app.inject({ method: 'GET', url: `/product-backlog?projectId=${product.id}` })).json<any[]>()).toEqual([expect.objectContaining({ item: expect.objectContaining({ id: backlogItem.id }), feature: expect.objectContaining({ id: feature.id }), delivery: expect.objectContaining({ id: delivery.id }) })]);
    const sprint = (await app.inject({ method: 'POST', url: '/scrum-sprints', payload: { projectId: product.id, number: 1, goal: 'Deliver usable long-form playback', startsAt: '2026-09-07T09:00:00Z', endsAt: '2026-09-14T09:00:00Z' } })).json<any>();
    expect((await app.inject({ method: 'POST', url: `/scrum-sprints/${sprint.id}/items`, payload: { backlogItemId: backlogItem.id } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/scrum-sprints/${sprint.id}/status`, payload: { status: 'active' } })).json()).toMatchObject({ status: 'active', goal: 'Deliver usable long-form playback' });
    expect((await app.inject({ method: 'POST', url: `/product-backlog/${backlogItem.id}/status`, payload: { status: 'done' } })).statusCode).toBe(200);
    const increment = await app.inject({ method: 'POST', url: '/increments', payload: { projectId: product.id, sprintId: sprint.id, title: 'Long-form playback increment', evidence: { tests: 'passed' } } });
    expect(increment.statusCode).toBe(201);
    expect(increment.json()).toMatchObject({ definitionOfDone: expect.stringContaining('usable'), sprintId: sprint.id });

    const tooLong = await app.inject({ method: 'POST', url: '/scrum-sprints', payload: { projectId: product.id, number: 2, goal: 'Invalid timebox', startsAt: '2026-09-01T09:00:00Z', endsAt: '2026-10-15T09:00:00Z' } });
    expect(tooLong.statusCode).toBe(500);
    expect(tooLong.json()).toMatchObject({ message: expect.stringContaining('one month') });
  }, 30_000);
});
