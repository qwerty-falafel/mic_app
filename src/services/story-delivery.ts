import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse as parseYaml } from 'yaml';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { artifactRevisions, auditEvents, integrationDecisions, repositories, storyUnits, workstreams } from '../db/schema.js';

const exec = promisify(execFile);

export class StoryDeliveryService {
  constructor(private readonly db: Database) {}

  async sync(workstreamId: string) {
    const [inventory] = await this.db.select().from(artifactRevisions).where(and(eq(artifactRevisions.workstreamId, workstreamId), eq(artifactRevisions.type, 'story-inventory'))).orderBy(desc(artifactRevisions.createdAt)).limit(1);
    if (!inventory || (inventory.metadata as any)?.valid === false) throw new Error('A valid stories.yaml revision is required');
    const parsed = parseYaml(inventory.content), entries = Array.isArray(parsed) ? parsed : parsed?.stories;
    if (!Array.isArray(entries)) throw new Error('stories.yaml does not contain a story list');
    const rows = [];
    for (const [order, entry] of entries.entries()) {
      const storyKey = String(entry.id);
      const [row] = await this.db.insert(storyUnits).values({ id: `story_${randomUUID()}`, workstreamId, storyKey, order, title: String(entry.title ?? storyKey), description: String(entry.description ?? ''), status: String(entry.status ?? 'backlog'), parentArtifactId: inventory.id, metadata: entry }).onConflictDoUpdate({ target: [storyUnits.workstreamId, storyUnits.storyKey], set: { order, title: String(entry.title ?? storyKey), description: String(entry.description ?? ''), parentArtifactId: inventory.id, metadata: entry, updatedAt: new Date() } }).returning();
      rows.push(row!);
    }
    return rows;
  }

  list(workstreamId: string) { return this.db.select().from(storyUnits).where(eq(storyUnits.workstreamId, workstreamId)).orderBy(asc(storyUnits.order)); }

  async dispatch(storyId: string, skill: 'bmad-build' | 'bmad-build-auto') {
    const [story] = await this.db.select().from(storyUnits).where(eq(storyUnits.id, storyId));
    if (!story || !['backlog', 'ready-for-dev', 'blocked'].includes(story.status)) throw new Error('Story is not eligible for dispatch');
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, story.workstreamId));
    const [parent] = story.parentArtifactId ? await this.db.select().from(artifactRevisions).where(eq(artifactRevisions.id, story.parentArtifactId)) : [];
    if (!stream || !parent || (parent.metadata as any)?.valid === false) throw new Error('Story parent context is invalid');
    if (skill === 'bmad-build-auto' && (!story.description.trim() || !parent.path.endsWith('stories.yaml'))) throw new Error('Build Auto requires one bounded story and its valid parent inventory');
    await this.db.update(storyUnits).set({ status: 'queued', updatedAt: new Date() }).where(eq(storyUnits.id, story.id));
    return { workstreamId: stream.id, skill, action: undefined, args: { storyId: story.storyKey, storiesPath: parent.path }, prompt: `Implement exactly story ${story.storyKey}: ${story.title}\n\n${story.description}\n\nParent inventory: ${parent.path}. Do not select or implement any other story.` };
  }

  async update(storyId: string, status: string, evidence: Record<string, unknown>, actor: string) {
    const [story] = await this.db.update(storyUnits).set({ status, metadata: { evidence }, updatedAt: new Date() }).where(eq(storyUnits.id, storyId)).returning();
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
