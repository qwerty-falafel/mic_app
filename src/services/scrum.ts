import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { features, increments, productBacklogItems, projects, scrumSprints, sprintBacklogItems, storyUnits, workstreams } from '../db/schema.js';

const monthMs = 31 * 24 * 60 * 60 * 1000;

export class ScrumService {
  constructor(private readonly db: Database) {}

  listBacklog(projectId: string) {
    return this.db.select({ item: productBacklogItems, feature: features, delivery: workstreams, story: storyUnits })
      .from(productBacklogItems)
      .leftJoin(features, eq(productBacklogItems.featureId, features.id))
      .leftJoin(workstreams, eq(productBacklogItems.workstreamId, workstreams.id))
      .leftJoin(storyUnits, eq(productBacklogItems.storyUnitId, storyUnits.id))
      .where(eq(productBacklogItems.projectId, projectId)).orderBy(asc(productBacklogItems.order), asc(productBacklogItems.createdAt));
  }

  async createBacklogItem(input: { projectId: string; featureId?: string; workstreamId?: string; storyUnitId?: string; kind: string; title: string; description?: string; order?: number; acceptanceCriteria?: string[] }) {
    const [row] = await this.db.insert(productBacklogItems).values({ id: `pbi_${randomUUID()}`, ...input, description: input.description ?? '', order: input.order ?? 0, acceptanceCriteria: input.acceptanceCriteria ?? [] }).returning();
    return row!;
  }

  async createSprint(input: { projectId: string; number: number; goal: string; startsAt: Date; endsAt: Date }) {
    if (input.endsAt <= input.startsAt) throw new Error('Sprint end must be after its start');
    if (input.endsAt.getTime() - input.startsAt.getTime() > monthMs) throw new Error('A Scrum Sprint cannot be longer than one month');
    const [row] = await this.db.insert(scrumSprints).values({ id: `sprint_${randomUUID()}`, ...input }).returning();
    return row!;
  }

  async listSprints(projectId: string) {
    const rows = await this.db.select().from(scrumSprints).where(eq(scrumSprints.projectId, projectId)).orderBy(desc(scrumSprints.number));
    const selected = rows.length ? await this.db.select({ sprintId: sprintBacklogItems.sprintId, item: productBacklogItems }).from(sprintBacklogItems).innerJoin(productBacklogItems, eq(sprintBacklogItems.backlogItemId, productBacklogItems.id)).where(inArray(sprintBacklogItems.sprintId, rows.map(row => row.id))) : [];
    return rows.map(sprint => ({ ...sprint, items: selected.filter(value => value.sprintId === sprint.id).map(value => value.item) }));
  }

  async selectItem(sprintId: string, backlogItemId: string) {
    const [[sprint], [item]] = await Promise.all([this.db.select().from(scrumSprints).where(eq(scrumSprints.id, sprintId)), this.db.select().from(productBacklogItems).where(eq(productBacklogItems.id, backlogItemId))]);
    if (!sprint || !item || sprint.projectId !== item.projectId) throw new Error('Sprint and backlog item must belong to the same Product');
    await this.db.insert(sprintBacklogItems).values({ sprintId, backlogItemId }).onConflictDoNothing();
    return this.listSprints(sprint.projectId);
  }

  async setSprintStatus(sprintId: string, status: 'planned' | 'active' | 'completed' | 'cancelled') {
    const [sprint] = await this.db.select().from(scrumSprints).where(eq(scrumSprints.id, sprintId));
    if (!sprint) throw new Error('Sprint not found');
    if (status === 'active') {
      const active = await this.db.select().from(scrumSprints).where(and(eq(scrumSprints.projectId, sprint.projectId), eq(scrumSprints.status, 'active')));
      if (active.some(value => value.id !== sprintId)) throw new Error('This Product already has an active Sprint');
    }
    const [updated] = await this.db.update(scrumSprints).set({ status, updatedAt: new Date() }).where(eq(scrumSprints.id, sprintId)).returning();
    return updated!;
  }

  async updateBacklogStatus(itemId: string, status: 'proposed' | 'ready' | 'in-progress' | 'done' | 'removed') {
    const [updated] = await this.db.update(productBacklogItems).set({ status, updatedAt: new Date() }).where(eq(productBacklogItems.id, itemId)).returning();
    if (!updated) throw new Error('Product Backlog Item not found');
    return updated;
  }

  async createIncrement(input: { projectId: string; sprintId?: string; title: string; description?: string; evidence?: Record<string, unknown> }) {
    const [product] = await this.db.select().from(projects).where(eq(projects.id, input.projectId));
    if (!product) throw new Error('Product not found');
    if (input.sprintId) {
      const [sprint] = await this.db.select().from(scrumSprints).where(eq(scrumSprints.id, input.sprintId));
      if (!sprint || sprint.projectId !== input.projectId) throw new Error('Sprint does not belong to this Product');
      const selected = await this.db.select({ status: productBacklogItems.status }).from(sprintBacklogItems).innerJoin(productBacklogItems, eq(sprintBacklogItems.backlogItemId, productBacklogItems.id)).where(eq(sprintBacklogItems.sprintId, input.sprintId));
      if (!selected.length || selected.some(value => value.status !== 'done')) throw new Error('Every selected Product Backlog Item must meet the Definition of Done');
    }
    const [row] = await this.db.insert(increments).values({ id: `increment_${randomUUID()}`, projectId: input.projectId, sprintId: input.sprintId, title: input.title, description: input.description ?? '', definitionOfDone: product.definitionOfDone, evidence: input.evidence ?? {} }).returning();
    return row!;
  }

  listIncrements(projectId: string) { return this.db.select().from(increments).where(eq(increments.projectId, projectId)).orderBy(desc(increments.createdAt)); }
}
