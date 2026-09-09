import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { artifactRevisions, auditEvents, integrationDecisions, productBacklogItems, productEpics, projects, repositories, reviewDecisions, storyUnits, workflowSessions, workstreams } from '../db/schema.js';
import type { StoryOutcome } from './story-outcomes.js';

const exec = promisify(execFile);

export function retainTrackedArtifactRefs(refs: unknown, trackedPaths: Iterable<string>) {
  const tracked = new Set(trackedPaths);
  return Array.isArray(refs) ? refs.filter((value): value is string => typeof value === 'string' && tracked.has(value)) : [];
}

export function integrationVerdict(artifacts: Array<{ path: string; metadata: unknown }>, expectedPath?: string) {
  const retrospective = artifacts.find(artifact => expectedPath ? artifact.path === expectedPath : artifact.path.endsWith('/RETROSPECTIVE.md') || artifact.path === 'RETROSPECTIVE.md');
  const verdict = (retrospective?.metadata as any)?.frontmatter?.verdict;
  return { found: Boolean(retrospective), verdict: typeof verdict === 'string' ? verdict : undefined, permitted: ['accepted', 'accepted-with-open-items'].includes(verdict) };
}

export class StoryDeliveryService {
  constructor(private readonly db: Database) {}

  async sync(workstreamId: string) {
    const [inventory] = await this.db.select().from(artifactRevisions).where(and(eq(artifactRevisions.workstreamId, workstreamId), eq(artifactRevisions.type, 'story-inventory'))).orderBy(desc(artifactRevisions.createdAt)).limit(1);
    if (!inventory || (inventory.metadata as any)?.valid === false) throw new Error('A valid stories.yaml revision is required');
    const [acceptance] = await this.db.select().from(reviewDecisions).where(and(eq(reviewDecisions.artifactRevisionId, inventory.id), eq(reviewDecisions.kind, 'accepted'))).orderBy(desc(reviewDecisions.createdAt)).limit(1);
    if (!acceptance) throw new Error('The exact stories.yaml revision must receive MIC human approval before synchronization');
    const parsed = parseYaml(inventory.content), entries = Array.isArray(parsed) ? parsed : parsed?.stories;
    if (!Array.isArray(entries)) throw new Error('stories.yaml does not contain a story list');
    const outcomes = (inventory.metadata as any)?.storyOutcomes as StoryOutcome[] | undefined;
    if (!Array.isArray(outcomes) || outcomes.length !== entries.length) throw new Error('stories.yaml has not passed MIC Story outcome analysis');
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, workstreamId));
    if (!stream) throw new Error('Workstream not found');
    const [product] = await this.db.select().from(projects).where(eq(projects.id, stream.projectId));
    const [epic] = await this.db.select().from(productEpics).where(eq(productEpics.workstreamId, workstreamId));
    const existingItems = await this.db.select().from(productBacklogItems).where(eq(productBacklogItems.projectId, stream.projectId));
    const prefix = product!.slug.split('-').slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P';
    let nextOrder = existingItems.length ? Math.max(...existingItems.map(row => row.order)) + 1 : 0;
    const rows: Array<{ story: typeof storyUnits.$inferSelect; backlogItem: typeof productBacklogItems.$inferSelect; changedRevision: boolean }> = [];
    await this.db.transaction(async tx => {
      for (const [order, entry] of entries.entries()) {
        if (!entry?.id) throw new Error(`stories.yaml entry ${order + 1} has no BMAD story key`);
        const storyKey = String(entry.id), title = String(entry.title ?? storyKey), description = String(entry.description ?? ''), outcome = outcomes.find(value => value.id === storyKey);
        if (!outcome) throw new Error(`Story ${storyKey} has no validated outcome`);
        const storyMetadata = { ...entry, outcome, sourceArtifactHash: inventory.contentHash, sourceArtifactRevisionId: inventory.id };
        const [story] = await tx.insert(storyUnits).values({ id: `story_${randomUUID()}`, workstreamId, storyKey, order, title, description, status: 'backlog', parentArtifactId: inventory.id, metadata: storyMetadata }).onConflictDoUpdate({ target: [storyUnits.workstreamId, storyUnits.storyKey], set: { order, title, description, parentArtifactId: inventory.id, metadata: storyMetadata, updatedAt: new Date() } }).returning();
        const prior = existingItems.find(value => value.storyUnitId === story!.id);
        const criteria = entry.acceptanceCriteria ?? entry.acceptance_criteria ?? [];
        const changedRevision = Boolean(prior?.sourceArtifactId && prior.sourceArtifactId !== inventory.id);
        let backlogItem;
        if (prior) {
          [backlogItem] = await tx.update(productBacklogItems).set({ epicId: epic?.id, workstreamId, sourceArtifactId: inventory.id, sourceArtifactHash: inventory.contentHash, sourceStoryKey: storyKey, title, value: outcome.motive, description, acceptanceCriteria: Array.isArray(criteria) ? criteria.map(String) : [], updatedAt: new Date() }).where(eq(productBacklogItems.id, prior.id)).returning();
        } else {
          [backlogItem] = await tx.insert(productBacklogItems).values({ id: `pbi_${randomUUID()}`, projectId: stream.projectId, epicId: epic?.id, workstreamId, storyUnitId: story!.id, sourceArtifactId: inventory.id, sourceArtifactHash: inventory.contentHash, sourceStoryKey: storyKey, deliveryPath: 'spec-epic', deliveryRationale: 'Accepted BMAD Story Breakdown', reference: `${prefix}-${existingItems.length + rows.length + 1}`, kind: 'story', title, value: outcome.motive, description, acceptanceCriteria: Array.isArray(criteria) ? criteria.map(String) : [], status: 'proposed', order: nextOrder++ }).returning();
        }
        await tx.insert(auditEvents).values({ aggregateType: 'story_projection', aggregateId: story!.id, action: changedRevision ? 'revision.updated' : 'synchronized', actor: acceptance.actor, detail: { workstreamId, artifactRevisionId: inventory.id, artifactHash: inventory.contentHash, storyKey, backlogItemId: backlogItem!.id }, idempotencyKey: `${story!.id}:${inventory.id}:product-backlog` }).onConflictDoNothing();
        rows.push({ story: story!, backlogItem: backlogItem!, changedRevision });
      }
    });
    return { artifact: { id: inventory.id, path: inventory.path, contentHash: inventory.contentHash, acceptedBy: acceptance.actor }, stories: rows };
  }

  list(workstreamId: string) { return this.db.select().from(storyUnits).where(eq(storyUnits.workstreamId, workstreamId)).orderBy(asc(storyUnits.order)); }

  async dispatch(storyId: string, skill: 'bmad-build' | 'bmad-build-auto') {
    const [story] = await this.db.select().from(storyUnits).where(eq(storyUnits.id, storyId));
    if (!story || !['backlog', 'ready-for-dev', 'blocked'].includes(story.status)) throw new Error('Story is not eligible for dispatch');
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, story.workstreamId));
    const [parent] = story.parentArtifactId ? await this.db.select().from(artifactRevisions).where(eq(artifactRevisions.id, story.parentArtifactId)) : [];
    if (!stream || !parent || (parent.metadata as any)?.valid === false) throw new Error('Story parent context is invalid');
    const [accepted] = await this.db.select().from(reviewDecisions).where(and(eq(reviewDecisions.artifactRevisionId, parent.id), eq(reviewDecisions.kind, 'accepted'))).limit(1);
    if (!accepted) throw new Error('The Story parent artifact requires MIC human approval before Build');
    const active = await this.db.select().from(workflowSessions).where(and(eq(workflowSessions.storyUnitId, story.id), inArray(workflowSessions.status, ['QUEUED', 'RESOURCE_WAITING', 'RUNNING', 'WAITING_FOR_INPUT', 'BLOCKED', 'PAUSED', 'INTERRUPTED', 'NEEDS_CLASSIFICATION']))).limit(1);
    if (active.length) throw new Error('This Story already has an active BMAD Build session');
    const metadata = story.metadata as any;
    if (skill === 'bmad-build-auto' && metadata?.outcome?.specCheckpoint) throw new Error('This Story requires attended BMAD Build and human Story-spec approval');
    if (skill === 'bmad-build-auto' && (!story.description.trim() || !parent.path.endsWith('stories.yaml'))) throw new Error('Build Auto requires one bounded story and its valid parent inventory');
    const specFolder = dirname(parent.path);
    const guidance = metadata?.outcome?.invokeDevWith ? `\n\nAdditional human dispatch guidance:\n${metadata.outcome.invokeDevWith}` : '';
    return { workstreamId: stream.id, storyUnitId: story.id, skill, action: undefined, args: { storyId: story.storyKey, specFolder, storiesPath: parent.path, artifactRevisionId: parent.id, artifactHash: parent.contentHash }, prompt: `Implement exactly one accepted BMAD Story.\n\nBMAD spec folder: ${specFolder}\nBMAD Story id: ${story.storyKey}\nAccepted artifact revision: ${parent.id}\nAccepted artifact hash: ${parent.contentHash}\n\n${story.title}\n${story.description}${guidance}\n\nDo not select or implement any other Story.` };
  }

  async update(storyId: string, status: string, evidence: Record<string, unknown>, actor: string) {
    const [current] = await this.db.select().from(storyUnits).where(eq(storyUnits.id, storyId));
    const metadata = (current?.metadata as Record<string, unknown>) ?? {};
    let artifactRefs = Array.isArray(metadata.artifactRefs) ? metadata.artifactRefs.filter((value): value is string => typeof value === 'string') : [];
    if (status === 'done' && artifactRefs.length && typeof metadata.sessionId === 'string') {
      const [session] = await this.db.select().from(workflowSessions).where(eq(workflowSessions.id, metadata.sessionId));
      const raw = session?.rawState as any;
      const workspace = raw?.rawAdapterState?.worktree ?? raw?.workspace;
      if (typeof workspace === 'string') {
        try {
          artifactRefs = retainTrackedArtifactRefs(artifactRefs, (await exec('git', ['-C', workspace, 'ls-files'])).stdout.split(/\r?\n/).filter(Boolean));
        } catch { /* Preserve the recorded references when Git provenance cannot be read. */ }
      }
    }
    const [story] = await this.db.update(storyUnits).set({ status, metadata: { ...metadata, artifactRefs, evidence }, updatedAt: new Date() }).where(eq(storyUnits.id, storyId)).returning();
    if (!story) throw new Error('Story not found');
    await this.db.insert(auditEvents).values({ aggregateType: 'story', aggregateId: storyId, action: `status.${status}`, actor, detail: evidence, idempotencyKey: `${storyId}:${status}:${randomUUID()}` });
    return story;
  }

  async retrospectiveReady(workstreamId: string) {
    const stories = await this.list(workstreamId), unfinished = stories.filter(story => !['done', 'complete', 'completed'].includes(story.status));
    return { ready: stories.length > 0 && unfinished.length === 0, total: stories.length, unfinished: unfinished.map(story => ({ id: story.storyKey, title: story.title, status: story.status })) };
  }

  async integrate(workstreamId: string, actor: string) {
    const readiness = await this.retrospectiveReady(workstreamId);
    if (!readiness.ready) throw new Error('All stories must be complete before integration');
    const accepted = await this.db.select({ id: reviewDecisions.id }).from(reviewDecisions).innerJoin(artifactRevisions, eq(reviewDecisions.artifactRevisionId, artifactRevisions.id)).where(and(eq(artifactRevisions.workstreamId, workstreamId), eq(reviewDecisions.kind, 'accepted'))).limit(1);
    if (!accepted.length) throw new Error('At least one final artifact revision must be explicitly accepted before integration');
    const retrospective = await this.db.select().from(workflowSessions).where(and(eq(workflowSessions.workstreamId, workstreamId), eq(workflowSessions.skill, 'bmad-retrospective'), eq(workflowSessions.status, 'FINISHED'))).limit(1);
    if (!retrospective.length) throw new Error('A finished BMAD retrospective is required before integration');
    const [firstStory] = await this.db.select().from(storyUnits).where(eq(storyUnits.workstreamId, workstreamId)).orderBy(asc(storyUnits.order)).limit(1);
    const [storyInventory] = firstStory?.parentArtifactId ? await this.db.select().from(artifactRevisions).where(eq(artifactRevisions.id, firstStory.parentArtifactId)) : [];
    if (!storyInventory) throw new Error('Story inventory provenance is required before integration');
    const expectedRetrospectivePath = `${dirname(storyInventory.path)}/RETROSPECTIVE.md`;
    const retrospectiveArtifacts = await this.db.select().from(artifactRevisions).where(eq(artifactRevisions.workstreamId, workstreamId)).orderBy(desc(artifactRevisions.createdAt));
    const retrospectiveDecision = integrationVerdict(retrospectiveArtifacts, expectedRetrospectivePath);
    if (!retrospectiveDecision.found) throw new Error('An indexed BMAD RETROSPECTIVE.md artifact is required before integration');
    if (!retrospectiveDecision.permitted) throw new Error(`The BMAD retrospective verdict does not permit integration: ${retrospectiveDecision.verdict ?? 'missing'}`);
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, workstreamId));
    const [repository] = stream?.repositoryId ? await this.db.select().from(repositories).where(eq(repositories.id, stream.repositoryId)) : [];
    if (!stream?.workspacePath || !stream.baselineRevision || !repository) throw new Error('Workstream Git provenance is unavailable');
    const status = (await exec('git', ['-C', repository.path, 'status', '--porcelain'])).stdout.trim();
    if (status) throw new Error(`Base repository is dirty: ${status}`);
    const baseRevision = (await exec('git', ['-C', repository.path, 'rev-parse', repository.baseBranch])).stdout.trim();
    const resultRevision = (await exec('git', ['-C', stream.workspacePath, 'rev-parse', 'HEAD'])).stdout.trim();
    try { await exec('git', ['-C', repository.path, 'merge-base', '--is-ancestor', baseRevision, resultRevision]); }
    catch { throw new Error('Workstream result is not a fast-forward of the current base branch'); }
    await exec('git', ['-C', repository.path, 'merge', '--ff-only', resultRevision]);
    const [decision] = await this.db.insert(integrationDecisions).values({ id: `integration_${randomUUID()}`, workstreamId, actor, baseRevision, resultRevision, status: 'integrated', detail: { branch: stream.branch } }).returning();
    await this.db.update(workstreams).set({ status: 'COMPLETED', updatedAt: new Date() }).where(eq(workstreams.id, workstreamId));
    await this.db.insert(auditEvents).values({ aggregateType: 'workstream', aggregateId: workstreamId, action: 'integrated', actor, detail: { baseRevision, resultRevision }, idempotencyKey: `${decision!.id}:audit` });
    return decision;
  }
}
