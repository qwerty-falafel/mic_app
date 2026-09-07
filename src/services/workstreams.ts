import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { auditEvents, outboxEvents, repositories, workflowDefinitions, workstreams } from '../db/schema.js';
import { durableSlug } from './slugs.js';

function stable(prefix: string, key: string) {
  return `${prefix}_${createHash('sha256').update(`${prefix}:${key}`).digest('hex').slice(0, 24)}`;
}

export class WorkstreamService {
  constructor(private readonly db: Database) {}

  async create(input: { projectId: string; repositoryId?: string; legacyWorkItemId?: string; title: string; intent: string; path: 'undecided' | 'direct' | 'spec-epic' | 'project' | 'specialist' }, commandKey: string = randomUUID(), actor = 'api') {
    const entityId = stable('workstream', commandKey);
    const classification = input.path === 'direct' ? 'change' : input.path === 'spec-epic' ? 'epic' : input.path === 'project' ? 'product-initiative' : input.path === 'specialist' ? 'research' : 'unclassified';
    const values = { ...input, slug: durableSlug(input.title, commandKey), summary: input.intent.replace(/\s+/g, ' ').trim().slice(0, 240), classification };
    return this.db.transaction(async tx => {
      const existing = await tx.select().from(workstreams).where(eq(workstreams.id, entityId));
      if (!existing.length) await tx.insert(workstreams).values({ id: entityId, ...values });
      const [row] = await tx.select().from(workstreams).where(eq(workstreams.id, entityId));
      await tx.insert(auditEvents).values({ aggregateType: 'workstream', aggregateId: entityId, action: 'created', actor, detail: values, idempotencyKey: `workstream:${commandKey}:audit` }).onConflictDoNothing();
      await tx.insert(outboxEvents).values({ id: stable('evt', `workstream:${commandKey}`), topic: 'workstream.created', payload: { id: entityId, ...values }, idempotencyKey: `workstream:${commandKey}:outbox` }).onConflictDoNothing();
      return row;
    });
  }

  list(projectId?: string) { return projectId ? this.db.select().from(workstreams).where(eq(workstreams.projectId, projectId)).orderBy(desc(workstreams.updatedAt)) : this.db.select().from(workstreams).orderBy(desc(workstreams.updatedAt)); }

  async getByReference(reference: string, projectId?: string) {
    const [byId] = await this.db.select().from(workstreams).where(eq(workstreams.id, reference)).limit(1);
    if (byId && (!projectId || byId.projectId === projectId)) return byId;
    const rows = projectId
      ? await this.db.select().from(workstreams).where(and(eq(workstreams.projectId, projectId), eq(workstreams.slug, reference))).limit(1)
      : await this.db.select().from(workstreams).where(eq(workstreams.slug, reference)).limit(2);
    if (rows.length > 1) throw new Error('Delivery slug requires Product context');
    return rows[0];
  }

  async selectPath(workstreamId: string, path: 'direct' | 'spec-epic' | 'project' | 'specialist', actor = 'api') {
    return this.db.transaction(async tx => {
      const [stream] = await tx.select().from(workstreams).where(eq(workstreams.id, workstreamId));
      if (!stream) throw new Error('Workstream not found');
      if (stream.path !== 'undecided' && stream.path !== path) throw new Error('A selected development path cannot be replaced; use Correct Course');
      const classification = path === 'direct' ? 'change' : path === 'spec-epic' ? 'epic' : path === 'project' ? 'product-initiative' : 'research';
      const [updated] = await tx.update(workstreams).set({ path, classification, updatedAt: new Date() }).where(eq(workstreams.id, workstreamId)).returning();
      await tx.insert(auditEvents).values({ aggregateType: 'workstream', aggregateId: workstreamId, action: 'path.selected', actor, detail: { path }, idempotencyKey: `${workstreamId}:path:${path}` }).onConflictDoNothing();
      return updated;
    });
  }

  async operations(workstreamId: string) {
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, workstreamId));
    if (!stream?.repositoryId) return [];
    const all = await this.db.select().from(workflowDefinitions).where(eq(workflowDefinitions.repositoryId, stream.repositoryId));
    const allowed = stream.path === 'direct' ? new Set(['bmad-help', 'bmad-build'])
      : stream.path === 'spec-epic' ? new Set(['bmad-help', 'bmad-project-context', 'bmad-spec', 'bmad-code-review', 'bmad-walkthrough', 'bmad-retrospective', 'bmad-correct-course'])
      : stream.path === 'project' ? new Set(['bmad-help', 'bmad-product-brief', 'bmad-prd', 'bmad-ux', 'bmad-architecture', 'bmad-create-epics-and-stories', 'bmad-sprint-planning', 'bmad-project-context', 'bmad-correct-course'])
      : stream.path === 'specialist' ? new Set(['bmad-help', 'bmad-deep-recon', 'bmad-review', 'bmad-code-review', 'bmad-correct-course']) : new Set(['bmad-help']);
    return all.filter(row => !allowed || allowed.has(row.skill));
  }

  async requireDefinition(repositoryId: string, skill: string, action?: string) {
    const rows = await this.db.select().from(workflowDefinitions).where(and(eq(workflowDefinitions.repositoryId, repositoryId), eq(workflowDefinitions.skill, skill)));
    const row = rows.find(candidate => (candidate.action ?? undefined) === action) ?? (action ? undefined : rows[0]);
    if (!row) throw new Error(`BMAD skill/action is unavailable: ${skill}${action ? `:${action}` : ''}`);
    return row;
  }
}
