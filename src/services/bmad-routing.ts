import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { auditEvents, productBacklogItems, productEpics, repositories, workflowDefinitions, workstreams } from '../db/schema.js';
import { WorkstreamService } from './workstreams.js';

export type BmadPath = 'direct' | 'spec-epic' | 'project';

const routeContract = {
  direct: { label: 'Direct Build', next: 'One bounded BMAD Build session', required: ['bmad-build'] },
  'spec-epic': { label: 'Specification and Stories', next: 'BMAD SPEC.md, human approval, Story Breakdown, then one Build per Story', required: ['bmad-spec'] },
  project: { label: 'Project-sized planning', next: 'Justified BMAD product and solution planning before per-Epic delivery', required: ['bmad-product-brief', 'bmad-prd', 'bmad-create-epics-and-stories'] },
} as const;

export class BmadRoutingService {
  private readonly streams: WorkstreamService;
  constructor(private readonly db: Database) { this.streams = new WorkstreamService(db); }

  async describeForEpic(epicId: string, repositoryId?: string) {
    const [epic] = await this.db.select().from(productEpics).where(eq(productEpics.id, epicId));
    if (!epic) throw new Error('Epic not found');
    return this.describe(epic.projectId, (epic.deliveryPath as BmadPath | null) ?? 'spec-epic', epic.deliveryRationale || 'An Epic needs a BMAD specification and bounded Story decomposition.', repositoryId);
  }

  async describeForItem(itemId: string, repositoryId?: string) {
    const [item] = await this.db.select().from(productBacklogItems).where(eq(productBacklogItems.id, itemId));
    if (!item) throw new Error('Product Backlog Item not found');
    const recommended = (item.deliveryPath as BmadPath | null) ?? 'direct';
    return this.describe(item.projectId, recommended, item.deliveryRationale || 'This concrete Product Backlog Item is the bounded unit for one BMAD Build.', repositoryId);
  }

  private async describe(projectId: string, recommended: BmadPath, rationale: string, repositoryId?: string) {
    const repos = repositoryId
      ? await this.db.select().from(repositories).where(and(eq(repositories.id, repositoryId), eq(repositories.projectId, projectId)))
      : await this.db.select().from(repositories).where(eq(repositories.projectId, projectId));
    const repository = repos[0] ?? null;
    const definitions = repository ? await this.db.select().from(workflowDefinitions).where(eq(workflowDefinitions.repositoryId, repository.id)) : [];
    const available = new Set(definitions.map(row => row.skill));
    const alternatives = (Object.keys(routeContract) as BmadPath[]).map(path => ({ path, ...routeContract[path], available: Boolean(repository) && routeContract[path].required.every(skill => available.has(skill)), missing: routeContract[path].required.filter(skill => !available.has(skill)) }));
    return { recommended, rationale, repository, owner: 'BMAD', governance: 'MIC human approval of exact revisions', consequences: routeContract[recommended].next, alternatives };
  }

  async dispatchEpic(epicId: string, repositoryId: string, selectedPath: BmadPath | undefined, actor = 'api') {
    const [epic] = await this.db.select().from(productEpics).where(eq(productEpics.id, epicId));
    if (!epic) throw new Error('Epic not found');
    if (epic.workstreamId) { const [existing] = await this.db.select().from(workstreams).where(eq(workstreams.id, epic.workstreamId)); if (existing) return existing; }
    const recommended = (epic.deliveryPath as BmadPath | null) ?? 'spec-epic';
    const path = selectedPath ?? recommended;
    if (path === 'direct') throw new Error('An Epic cannot be dispatched wholesale as one Build; dispatch one bounded Product Backlog Item instead');
    const route = await this.describe(epic.projectId, path, epic.deliveryRationale, repositoryId);
    const chosen = route.alternatives.find(value => value.path === path)!;
    if (!chosen.available) throw new Error(`Required BMAD workflow is unavailable: ${chosen.missing.join(', ')}`);
    const stream = await this.streams.create({ projectId: epic.projectId, repositoryId, title: epic.name, intent: epic.outcome, path }, `epic:${epic.id}:delivery`, actor);
    await this.db.transaction(async tx => {
      await tx.update(productEpics).set({ workstreamId: stream!.id, deliveryPath: path, updatedAt: new Date() }).where(eq(productEpics.id, epic.id));
      await tx.update(productBacklogItems).set({ workstreamId: stream!.id, updatedAt: new Date() }).where(eq(productBacklogItems.epicId, epic.id));
      await tx.insert(auditEvents).values({ aggregateType: 'product_epic', aggregateId: epic.id, action: 'bmad_route.dispatched', actor, detail: { recommended, selected: path, overridden: path !== recommended, workstreamId: stream!.id }, idempotencyKey: `epic:${epic.id}:route:${path}` }).onConflictDoNothing();
    });
    return stream;
  }

  async prepareItemBuild(itemId: string, repositoryId: string, actor = 'api') {
    const [item] = await this.db.select().from(productBacklogItems).where(eq(productBacklogItems.id, itemId));
    if (!item) throw new Error('Product Backlog Item not found');
    if (item.storyUnitId) throw new Error('This BMAD-derived Story must be dispatched from its Story Build control');
    if (item.epicId && item.deliveryPath !== 'direct') throw new Error('This item requires its parent Epic BMAD planning route before Build');
    const route = await this.describe(item.projectId, 'direct', item.deliveryRationale, repositoryId);
    const direct = route.alternatives.find(value => value.path === 'direct')!;
    if (!direct.available) throw new Error(`Required BMAD workflow is unavailable: ${direct.missing.join(', ')}`);
    const existing = item.workstreamId ? (await this.db.select().from(workstreams).where(eq(workstreams.id, item.workstreamId)))[0] : undefined;
    const stream = existing ?? await this.streams.create({ projectId: item.projectId, repositoryId, title: item.title, intent: `${item.value}\n\n${item.description}`, path: 'direct' }, `pbi:${item.id}:delivery`, actor);
    await this.db.update(productBacklogItems).set({ workstreamId: stream!.id, deliveryPath: 'direct', updatedAt: new Date() }).where(eq(productBacklogItems.id, item.id));
    await this.db.insert(auditEvents).values({ aggregateType: 'product_backlog_item', aggregateId: item.id, action: 'bmad_route.dispatched', actor, detail: { selected: 'direct', workstreamId: stream!.id }, idempotencyKey: `pbi:${item.id}:route:direct` }).onConflictDoNothing();
    return stream;
  }
}
