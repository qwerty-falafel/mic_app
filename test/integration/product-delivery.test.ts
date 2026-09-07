import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { createServer } from 'node:net';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/api.js';
import { createDatabase } from '../../src/db/client.js';
import { migrateDatabase } from '../../src/db/migrate.js';
import { artifactRevisions, conversationTurns, integrationDecisions, productEpics, reviewDecisions, scrumSprints, workflowSessions } from '../../src/db/schema.js';
import { StoryDeliveryService } from '../../src/services/story-delivery.js';
import { analyseStoryInventory } from '../../src/services/story-outcomes.js';

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
    app = createApp(connection.db, undefined, { analyse: async ({ feedback }) => ({ rationale: feedback ? `Revised after: ${feedback}` : 'A Feature and Story provide the smallest useful outcome.', features: [{ name: 'Evidence search', description: 'Find supporting evidence.' }], epics: [{ name: 'Research workflow', outcome: 'A traceable research result.', featureNames: ['Evidence search'] }], items: [{ kind: 'story', title: feedback ? 'Review evidence clearly' : 'Search evidence', value: 'A researcher can find evidence with its provenance.', acceptanceCriteria: ['A result links to its source'], featureName: 'Evidence search', epicName: 'Research workflow' }], dependencies: [], uncertainties: [], deliveryRecommendation: { path: 'spec-epic', rationale: 'The coherent outcome needs an accepted specification and bounded Stories.', evidence: ['The proposal contains an Epic.'], nextArtifact: 'SPEC.md' } }) });
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
    await app.inject({ method: 'POST', url: `/product-goals/${secondGoal.id}/features`, payload: { featureId: feature.id } });
    const epic = (await app.inject({ method: 'POST', url: `/products/${product.id}/epics`, payload: { name: 'Long-form delivery', outcome: 'Continuous reading beyond one request.', featureIds: [feature.id] } })).json<any>();
    const delivery = (await app.inject({ method: 'POST', url: '/workstreams', headers: { 'idempotency-key': 'tts-delivery' }, payload: { projectId: product.id, title: 'Build reliable playback', intent: 'Stream long text through bounded chunks.', path: 'spec-epic' } })).json<any>();
    await app.inject({ method: 'POST', url: `/features/${feature.id}/deliveries`, payload: { workstreamId: delivery.id } });

    const overview = (await app.inject({ method: 'GET', url: `/products/${product.slug}` })).json<any>();
    expect(overview.goals).toEqual(expect.arrayContaining([expect.objectContaining({ id: firstGoal.id, status: 'abandoned' }), expect.objectContaining({ id: secondGoal.id, status: 'active' })]));
    expect(overview.features).toEqual([expect.objectContaining({ id: feature.id, status: 'active' })]);
    expect(overview.epics).toEqual([expect.objectContaining({ id: epic.id, status: 'proposed' })]);
    expect(overview.deliveries).toEqual([expect.objectContaining({ id: delivery.id, classification: 'epic', intent: 'Stream long text through bounded chunks.' })]);
    const roadmap = (await app.inject({ method: 'GET', url: `/products/${product.slug}/roadmap` })).json<any>();
    expect(roadmap.goalFeatureLinks).toContainEqual(expect.objectContaining({ goalId: secondGoal.id, featureId: feature.id }));
    expect(roadmap.epicFeatureLinks).toContainEqual(expect.objectContaining({ epicId: epic.id, featureId: feature.id }));

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

    await connection.db.insert(workflowSessions).values([
      { id: 'failed_breakdown_durable', workstreamId: delivery.id, skill: 'bmad-spec', action: 'create-stories', prompt: 'Story plan', status: 'FAILED', providerSessionId: 'provider_durable', createdAt: new Date('2026-09-07T09:00:00Z') },
      { id: 'failed_breakdown_retry', workstreamId: delivery.id, skill: 'bmad-spec', action: 'create-stories', prompt: 'Retry', status: 'FAILED', providerSessionId: 'provider_retry', createdAt: new Date('2026-09-07T10:00:00Z') },
    ]);
    await connection.db.insert(conversationTurns).values([
      { id: 'turn_durable_1', sessionId: 'failed_breakdown_durable', sequence: 1, role: 'assistant', content: 'Two Stories proposed' },
      { id: 'turn_durable_2', sessionId: 'failed_breakdown_durable', sequence: 2, role: 'user', content: 'Accepted' },
      { id: 'turn_retry_1', sessionId: 'failed_breakdown_retry', sequence: 1, role: 'user', content: 'Retry from Brief' },
    ]);
    const recovery = (await app.inject({ method: 'GET', url: `/workstreams/${delivery.id}/lifecycle` })).json<any>();
    expect(recovery).toMatchObject({ currentStage: { id: 'story-plan', state: 'needs-attention' }, attention: { id: 'failed_breakdown_durable', status: 'FAILED' }, recommendedAction: { id: 'resume-session', label: 'Resume from checkpoint' } });

    const backlogItem = (await app.inject({ method: 'POST', url: '/product-backlog', payload: { projectId: product.id, featureId: feature.id, epicId: epic.id, workstreamId: delivery.id, kind: 'story', title: 'Long-form playback', value: 'A listener can hear a long document without manually splitting it.', acceptanceCriteria: ['Reads beyond 5,000 characters'] } })).json<any>();
    expect(backlogItem.reference).toMatch(/^[A-Z]+-\d+$/);
    expect((await app.inject({ method: 'GET', url: `/product-backlog?projectId=${product.id}` })).json<any[]>()).toEqual([expect.objectContaining({ item: expect.objectContaining({ id: backlogItem.id }), feature: expect.objectContaining({ id: feature.id }), delivery: expect.objectContaining({ id: delivery.id }) })]);
    const sprint = (await app.inject({ method: 'POST', url: '/scrum-sprints', payload: { projectId: product.id, number: 1, goal: 'Deliver usable long-form playback', startsAt: '2026-09-07T09:00:00Z', endsAt: '2026-09-14T09:00:00Z' } })).json<any>();
    expect((await app.inject({ method: 'POST', url: `/scrum-sprints/${sprint.id}/items`, payload: { backlogItemId: backlogItem.id } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/scrum-sprints/${sprint.id}/status`, payload: { status: 'active' } })).json()).toMatchObject({ status: 'active', goal: 'Deliver usable long-form playback' });
    expect((await app.inject({ method: 'PUT', url: `/scrum-sprints/${sprint.id}/review`, payload: { summary: 'Chunked playback is usable.', stakeholderFeedback: 'Test a longer document.' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: `/scrum-sprints/${sprint.id}/retrospective`, payload: { insight: 'Bounded queues are easier to verify.', adaptation: 'Keep explicit cancellation tests.' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/scrum-sprints?projectId=${product.id}` })).json<any[]>()[0]).toMatchObject({ review: { summary: 'Chunked playback is usable.' }, retrospective: { adaptation: 'Keep explicit cancellation tests.' } });
    expect((await app.inject({ method: 'POST', url: `/product-backlog/${backlogItem.id}/status`, payload: { status: 'review' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/product-backlog/${backlogItem.reference}` })).json()).toMatchObject({ item: { id: backlogItem.id, status: 'review' }, epic: { id: epic.id } });
    expect((await app.inject({ method: 'POST', url: `/product-backlog/${backlogItem.id}/status`, payload: { status: 'done' } })).statusCode).toBe(200);
    const increment = await app.inject({ method: 'POST', url: '/increments', payload: { projectId: product.id, sprintId: sprint.id, title: 'Long-form playback increment', evidence: { tests: 'passed' } } });
    expect(increment.statusCode).toBe(201);
    expect(increment.json()).toMatchObject({ definitionOfDone: expect.stringContaining('usable'), sprintId: sprint.id });

    const tooLong = await app.inject({ method: 'POST', url: '/scrum-sprints', payload: { projectId: product.id, number: 2, goal: 'Invalid timebox', startsAt: '2026-09-01T09:00:00Z', endsAt: '2026-10-15T09:00:00Z' } });
    expect(tooLong.statusCode).toBe(409);
    expect(tooLong.json()).toMatchObject({ error: 'scrum_constraint', message: expect.stringContaining('one month') });
  }, 30_000);

  it('creates a Product without a repository and returns a server-owned portfolio projection', async () => {
    const created = await app.inject({ method: 'POST', url: '/products', headers: { 'idempotency-key': 'portfolio-product' }, payload: { name: 'Research Library', purpose: 'Make research decisions traceable.', productGoal: 'Validate the first useful research workflow.' } });
    expect(created.statusCode).toBe(201);
    const product = created.json<any>();
    const portfolio = (await app.inject({ method: 'GET', url: '/products' })).json<any[]>();
    expect(portfolio).toContainEqual(expect.objectContaining({
      product: expect.objectContaining({ id: product.id, purpose: 'Make research decisions traceable.', status: 'active' }),
      activeGoal: expect.objectContaining({ statement: 'Validate the first useful research workflow.', status: 'active' }),
      currentSprint: null,
      repositoryCount: 0,
      activeDeliveryCount: 0,
      attentionCount: 0,
      nextAction: null,
    }));
    for (const section of ['roadmap', 'briefs', 'backlog', 'board', 'sprints', 'releases', 'activity', 'settings']) {
      const document = await app.inject({ method: 'GET', url: `/products/${product.slug}/${section}`, headers: { accept: 'text/html' } });
      expect(document.statusCode).toBe(200);
      expect(document.headers['content-type']).toContain('text/html');
    }
    const archivedDelivery = (await app.inject({ method: 'POST', url: '/workstreams', headers: { 'idempotency-key': 'archived-product-delivery' }, payload: { projectId: product.id, title: 'Historical validation', intent: 'Retain evidence without showing active work.', path: 'project' } })).json<any>();
    await app.inject({ method: 'PATCH', url: `/products/${product.id}`, payload: { status: 'archived' } });
    expect((await app.inject({ method: 'GET', url: '/products' })).json<any[]>()).not.toContainEqual(expect.objectContaining({ product: expect.objectContaining({ id: product.id }) }));
    expect((await app.inject({ method: 'GET', url: '/workstreams' })).json<any[]>()).not.toContainEqual(expect.objectContaining({ id: archivedDelivery.id }));
    expect((await app.inject({ method: 'GET', url: `/products/${product.slug}` })).json()).toMatchObject({ product: { id: product.id, status: 'archived' } });
  });

  it('offers no stale next action after a delivery is integrated', async () => {
    const product = (await app.inject({ method: 'POST', url: '/products', headers: { 'idempotency-key': 'completed-product' }, payload: { name: 'Completed Product' } })).json<any>();
    const stream = (await app.inject({ method: 'POST', url: '/workstreams', headers: { 'idempotency-key': 'completed-delivery' }, payload: { projectId: product.id, title: 'Completed delivery', intent: 'Deliver and integrate a finished result.', path: 'spec-epic' } })).json<any>();
    await connection.db.insert(integrationDecisions).values({ id: 'integration_complete_projection', workstreamId: stream.id, actor: 'Michael', baseRevision: 'aaaaaaa', resultRevision: 'bbbbbbb', status: 'integrated' });

    const lifecycle = (await app.inject({ method: 'GET', url: `/workstreams/${stream.id}/lifecycle` })).json<any>();
    expect(lifecycle).toMatchObject({ currentStage: { id: 'integration', state: 'complete' }, recommendedAction: null, alternativeActions: [] });
  });

  it('keeps Brief proposals revision-bound and applies only an accepted revision', async () => {
    const product = (await app.inject({ method: 'POST', url: '/products', headers: { 'idempotency-key': 'proposal-product' }, payload: { name: 'Proposal Product', purpose: 'Test proposals.' } })).json<any>();
    const brief = (await app.inject({ method: 'POST', url: `/products/${product.id}/briefs`, payload: { title: 'Evidence workflow', content: 'Help researchers find cited evidence.' } })).json<any>();
    const first = (await app.inject({ method: 'POST', url: `/briefs/${brief.id}/analyse`, payload: {} })).json<any>();
    expect(first).toMatchObject({ revision: 1, status: 'proposed', model: expect.stringContaining('gpt-oss-120b') });
    expect(first.proposal.deliveryRecommendation).toMatchObject({ path: 'spec-epic', nextArtifact: 'SPEC.md' });
    await app.inject({ method: 'POST', url: `/product-proposals/${first.id}/decisions`, payload: { kind: 'revision-requested', actor: 'Michael', feedback: 'Make review explicit' } });
    expect((await app.inject({ method: 'GET', url: `/product-backlog?projectId=${product.id}` })).json()).toEqual([]);
    const second = (await app.inject({ method: 'POST', url: `/briefs/${brief.id}/analyse`, payload: { feedback: 'Make review explicit' } })).json<any>();
    expect(second).toMatchObject({ revision: 2, rationale: 'Revised after: Make review explicit' });
    expect((await app.inject({ method: 'POST', url: `/product-proposals/${second.id}/decisions`, payload: { kind: 'accepted', actor: 'Michael' } })).statusCode).toBe(200);
    const backlog = (await app.inject({ method: 'GET', url: `/product-backlog?projectId=${product.id}` })).json<any[]>();
    expect(backlog).toHaveLength(1);
    expect(backlog[0].item).toMatchObject({ kind: 'story', title: 'Review evidence clearly', status: 'proposed', sourceProposalId: second.id, deliveryPath: 'spec-epic' });
    const recommendation = (await app.inject({ method: 'GET', url: `/product-backlog/${backlog[0].item.id}/delivery-recommendation` })).json<any>();
    expect(recommendation).toMatchObject({ recommended: 'spec-epic', owner: 'BMAD', governance: expect.stringContaining('MIC human approval') });
    expect(recommendation.alternatives.every((route: any) => route.available === false)).toBe(true);
    const trace = (await app.inject({ method: 'GET', url: `/product-backlog/${backlog[0].item.id}/trace` })).json<any>();
    expect(trace).toMatchObject({ item: { id: backlog[0].item.id }, brief: { id: brief.id }, proposal: { id: second.id }, epic: { name: 'Research workflow' }, authorities: { backlogOrder: 'MIC/Scrum', planningAndBuild: 'BMAD', humanApproval: 'MIC' } });
    expect(trace.features).toContainEqual(expect.objectContaining({ name: 'Evidence search' }));
    expect((await app.inject({ method: 'POST', url: `/product-proposals/${second.id}/decisions`, payload: { kind: 'accepted', actor: 'Michael' } })).statusCode).toBe(409);
  });

  it('synchronizes only an accepted stories.yaml revision into the one Product Backlog', async () => {
    const product = (await app.inject({ method: 'POST', url: '/products', headers: { 'idempotency-key': 'story-sync-product' }, payload: { name: 'Story Sync Product' } })).json<any>();
    const epic = (await app.inject({ method: 'POST', url: `/products/${product.id}/epics`, payload: { name: 'Accepted breakdown', outcome: 'Deliver bounded stories.' } })).json<any>();
    const stream = (await app.inject({ method: 'POST', url: '/workstreams', headers: { 'idempotency-key': 'story-sync-stream' }, payload: { projectId: product.id, title: 'Accepted breakdown', intent: 'Plan and deliver bounded stories.', path: 'spec-epic' } })).json<any>();
    await connection.db.update(productEpics).set({ workstreamId: stream.id }).where(eq(productEpics.id, epic.id));
    const storySpec = '# Capabilities\n## CAP-1 Useful outcome';
    const firstContent = '- id: "1-1"\n  title: Receive the first useful outcome\n  description: As a research reader, I want to receive a cited result, so that I can use trustworthy evidence. Covers CAP-1.\n  spec_checkpoint: true\n  done_checkpoint: true\n  invoke_dev_with: Preserve citation provenance.\n';
    const firstAnalysis = analyseStoryInventory(firstContent, storySpec);
    const [inventory] = await connection.db.insert(artifactRevisions).values({ id: 'artifact_stories_v1', workstreamId: stream.id, path: '_bmad-output/specs/sync/stories.yaml', type: 'story-inventory', status: 'ready-for-dev', contentHash: 'stories-v1', content: firstContent, metadata: { valid: true, storyOutcomes: firstAnalysis.stories, warnings: firstAnalysis.warnings } }).returning();
    const refused = await app.inject({ method: 'POST', url: `/workstreams/${stream.id}/stories/sync`, payload: {} });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ message: expect.stringContaining('human approval') });
    await connection.db.insert(reviewDecisions).values({ id: 'review_stories_v1', artifactRevisionId: inventory!.id, kind: 'accepted', actor: 'Michael' });
    const sprintCountBefore = (await connection.db.select().from(scrumSprints)).length;
    const first = (await app.inject({ method: 'POST', url: `/workstreams/${stream.id}/stories/sync`, payload: {} })).json<any>();
    expect(first.artifact).toMatchObject({ id: inventory!.id, contentHash: 'stories-v1', acceptedBy: 'Michael' });
    expect(first.stories[0]).toMatchObject({ story: { storyKey: '1-1', parentArtifactId: inventory!.id }, backlogItem: { epicId: epic.id, sourceArtifactId: inventory!.id, sourceArtifactHash: 'stories-v1', sourceStoryKey: '1-1' } });
    expect(first.stories[0].backlogItem.value).toBe('I can use trustworthy evidence');
    await expect(new StoryDeliveryService(connection.db).dispatch(first.stories[0].story.id, 'bmad-build-auto')).rejects.toThrow('requires attended BMAD Build');
    const attended = await new StoryDeliveryService(connection.db).dispatch(first.stories[0].story.id, 'bmad-build');
    expect(attended).toMatchObject({ args: { storyId: '1-1', specFolder: '_bmad-output/specs/sync', artifactRevisionId: inventory!.id, artifactHash: 'stories-v1' } });
    expect(attended.prompt).toContain('Preserve citation provenance.');
    const second = (await app.inject({ method: 'POST', url: `/workstreams/${stream.id}/stories/sync`, payload: {} })).json<any>();
    expect(second.stories[0].backlogItem.id).toBe(first.stories[0].backlogItem.id);
    expect((await app.inject({ method: 'GET', url: `/product-backlog?projectId=${product.id}` })).json<any[]>()).toHaveLength(1);
    expect((await connection.db.select().from(scrumSprints)).length).toBe(sprintCountBefore);

    const revisedContent = '- id: "1-1"\n  title: Review the useful outcome\n  description: As a research reader, I want to review a cited result, so that I can trust the corrected evidence. Covers CAP-1.\n';
    const revisedAnalysis = analyseStoryInventory(revisedContent, storySpec);
    const [revised] = await connection.db.insert(artifactRevisions).values({ id: 'artifact_stories_v2', workstreamId: stream.id, path: inventory!.path, type: 'story-inventory', status: 'ready-for-dev', contentHash: 'stories-v2', content: revisedContent, metadata: { valid: true, storyOutcomes: revisedAnalysis.stories, warnings: revisedAnalysis.warnings }, createdAt: new Date(Date.now() + 1000) }).returning();
    await connection.db.insert(reviewDecisions).values({ id: 'review_stories_v2', artifactRevisionId: revised!.id, kind: 'accepted', actor: 'Michael' });
    const revisedSync = (await app.inject({ method: 'POST', url: `/workstreams/${stream.id}/stories/sync`, payload: {} })).json<any>();
    expect(revisedSync.stories[0]).toMatchObject({ changedRevision: true, backlogItem: { id: first.stories[0].backlogItem.id, title: 'Review the useful outcome', sourceArtifactId: revised!.id, sourceArtifactHash: 'stories-v2' } });
    expect((await app.inject({ method: 'GET', url: `/product-backlog?projectId=${product.id}` })).json<any[]>()).toHaveLength(1);
    const trace = (await app.inject({ method: 'GET', url: `/product-backlog/${first.stories[0].backlogItem.id}/trace` })).json<any>();
    expect(trace).toMatchObject({ bmad: { story: { storyKey: '1-1' }, artifact: { id: revised!.id, contentHash: 'stories-v2' } }, scrum: { sprints: [], increments: [] } });

    await connection.db.insert(workflowSessions).values({ id: 'active_story_build', workstreamId: stream.id, storyUnitId: first.stories[0].story.id, skill: 'bmad-build', prompt: 'bounded', status: 'RUNNING' });
    await expect(new StoryDeliveryService(connection.db).dispatch(first.stories[0].story.id, 'bmad-build')).rejects.toThrow('already has an active BMAD Build session');
  });

  it('routes through installed BMAD capabilities without dispatching an Epic as one Build', async () => {
    const product = (await app.inject({ method: 'POST', url: '/products', headers: { 'idempotency-key': 'route-product' }, payload: { name: 'Routed Product' } })).json<any>();
    const repositoryResponse = await app.inject({ method: 'POST', url: `/projects/${product.id}/repositories`, headers: { 'idempotency-key': 'route-repository' }, payload: { path: resolve('.'), baseBranch: 'main' } });
    expect(repositoryResponse.statusCode).toBe(201);
    const repository = repositoryResponse.json<any>();
    const epic = (await app.inject({ method: 'POST', url: `/products/${product.id}/epics`, payload: { name: 'Routed Epic', outcome: 'Plan a coherent multi-Story result.' } })).json<any>();
    const recommendation = (await app.inject({ method: 'GET', url: `/product-epics/${epic.id}/delivery-recommendation?repositoryId=${repository.id}` })).json<any>();
    expect(recommendation).toMatchObject({ recommended: 'spec-epic', owner: 'BMAD', consequences: expect.stringContaining('SPEC.md') });
    expect(recommendation.alternatives.find((route: any) => route.path === 'spec-epic')).toMatchObject({ available: true, missing: [] });
    const wholesale = await app.inject({ method: 'POST', url: `/product-epics/${epic.id}/dispatch`, payload: { repositoryId: repository.id, path: 'direct', actor: 'Michael' } });
    expect(wholesale.statusCode).toBe(400);
    const dispatched = await app.inject({ method: 'POST', url: `/product-epics/${epic.id}/dispatch`, payload: { repositoryId: repository.id, actor: 'Michael' } });
    expect(dispatched.statusCode).toBe(201);
    expect(dispatched.json()).toMatchObject({ path: 'spec-epic', repositoryId: repository.id, classification: 'epic' });
    const operations = (await app.inject({ method: 'GET', url: `/workstreams/${dispatched.json<any>().id}/operations` })).json<any[]>();
    expect(operations.some(operation => ['bmad-build', 'bmad-build-auto'].includes(operation.skill))).toBe(false);
    const wholeEpicBuild = await app.inject({ method: 'POST', url: '/workflow-sessions', payload: { workstreamId: dispatched.json<any>().id, skill: 'bmad-build', prompt: 'Build the Epic.' } });
    expect(wholeEpicBuild.statusCode).toBe(409);
    expect(wholeEpicBuild.json()).toMatchObject({ message: expect.stringContaining('not eligible') });

    const item = (await app.inject({ method: 'POST', url: '/product-backlog', payload: { projectId: product.id, kind: 'defect', title: 'Bounded defect', value: 'Restore one intended behaviour.' } })).json<any>();
    const direct = await app.inject({ method: 'POST', url: `/product-backlog/${item.id}/dispatch`, payload: { repositoryId: repository.id, actor: 'Michael' } });
    expect(direct.statusCode).toBe(201);
    expect(direct.json()).toMatchObject({ path: 'direct', classification: 'change' });
  });
});
