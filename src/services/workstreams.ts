import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { auditEvents, outboxEvents, repositories, workflowDefinitions, workstreams } from '../db/schema.js';

function stable(prefix: string, key: string) {
  return `${prefix}_${createHash('sha256').update(`${prefix}:${key}`).digest('hex').slice(0, 24)}`;
}

export class WorkstreamService {
  constructor(private readonly db: Database) {}

  async create(input: { projectId: string; repositoryId?: string; legacyWorkItemId?: string; title: string; intent: string; path: 'undecided' | 'direct' | 'spec-epic' | 'project' | 'specialist' }, commandKey: string = randomUUID(), actor = 'api') {
    const entityId = stable('workstream', commandKey);
    return this.db.transaction(async tx => {
      const existing = await tx.select().from(workstreams).where(eq(workstreams.id, entityId));
      if (!existing.length) await tx.insert(workstreams).values({ id: entityId, ...input });
      const [row] = await tx.select().from(workstreams).where(eq(workstreams.id, entityId));
      await tx.insert(auditEvents).values({ aggregateType: 'workstream', aggregateId: entityId, action: 'created', actor, detail: input, idempotencyKey: `workstream:${commandKey}:audit` }).onConflictDoNothing();
      await tx.insert(outboxEvents).values({ id: stable('evt', `workstream:${commandKey}`), topic: 'workstream.created', payload: { id: entityId, ...input }, idempotencyKey: `workstream:${commandKey}:outbox` }).onConflictDoNothing();
      return row;
    });
  }

  list(projectId?: string) { return projectId ? this.db.select().from(workstreams).where(eq(workstreams.projectId, projectId)).orderBy(desc(workstreams.updatedAt)) : this.db.select().from(workstreams).orderBy(desc(workstreams.updatedAt)); }

  async operations(workstreamId: string) {
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, workstreamId));
    if (!stream?.repositoryId) return [];
    const all = await this.db.select().from(workflowDefinitions).where(eq(workflowDefinitions.repositoryId, stream.repositoryId));
    const allowed = stream.path === 'direct' ? new Set(['bmad-help', 'bmad-build'])
      : stream.path === 'spec-epic' ? new Set(['bmad-help', 'bmad-project-context', 'bmad-spec', 'bmad-build', 'bmad-build-auto', 'bmad-code-review', 'bmad-walkthrough', 'bmad-retrospective', 'bmad-correct-course'])
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
