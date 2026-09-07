import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { featureDeliveryCases, features, productGoals, projects, repositories, scrumSprints, workstreams } from '../db/schema.js';
import { durableSlug } from './slugs.js';

export class ProductService {
  constructor(private readonly db: Database) {}

  async getByReference(reference: string) {
    const [product] = await this.db.select().from(projects).where(eq(projects.id, reference)).limit(1);
    if (product) return product;
    const [bySlug] = await this.db.select().from(projects).where(eq(projects.slug, reference)).limit(1);
    return bySlug;
  }

  async portfolio(projectDelivery: (workstreamId: string) => Promise<any>) {
    const rows = await this.db.select().from(projects).orderBy(asc(projects.name));
    return Promise.all(rows.map(async product => {
      const [[activeGoal], [currentSprint], [repositoryCount], deliveries] = await Promise.all([
        this.db.select().from(productGoals).where(and(eq(productGoals.projectId, product.id), eq(productGoals.status, 'active'))).orderBy(desc(productGoals.updatedAt)).limit(1),
        this.db.select().from(scrumSprints).where(and(eq(scrumSprints.projectId, product.id), eq(scrumSprints.status, 'active'))).limit(1),
        this.db.select({ value: count() }).from(repositories).where(eq(repositories.projectId, product.id)),
        this.db.select().from(workstreams).where(and(eq(workstreams.projectId, product.id), eq(workstreams.status, 'ACTIVE'))).orderBy(desc(workstreams.updatedAt)),
      ]);
      const states = await Promise.all(deliveries.map(row => projectDelivery(row.id).catch(() => undefined)));
      const requiringAttention = states.filter(state => state?.attention || ['blocked', 'failed', 'awaiting-decision'].includes(state?.currentStage?.state));
      const focus = requiringAttention[0] ?? states.find(Boolean);
      return {
        product,
        activeGoal: activeGoal ?? null,
        currentSprint: currentSprint ?? null,
        repositoryCount: Number(repositoryCount?.value ?? 0),
        activeDeliveryCount: deliveries.length,
        attentionCount: requiringAttention.length,
        nextAction: focus?.recommendedAction ? { ...focus.recommendedAction, deliveryId: focus.delivery.id, deliverySlug: focus.delivery.slug } : null,
      };
    }));
  }

  async updateProduct(projectId: string, input: { name?: string; purpose?: string; status?: 'active' | 'archived' }) {
    const [product] = await this.db.update(projects).set(input).where(eq(projects.id, projectId)).returning();
    if (!product) throw new Error('Product not found');
    return product;
  }

  goals(projectId: string) { return this.db.select().from(productGoals).where(eq(productGoals.projectId, projectId)).orderBy(desc(productGoals.updatedAt)); }

  async createGoal(projectId: string, statement: string, status: 'proposed' | 'active' = 'proposed') {
    return this.db.transaction(async tx => {
      if (status === 'active') await tx.update(productGoals).set({ status: 'abandoned', updatedAt: new Date() }).where(and(eq(productGoals.projectId, projectId), eq(productGoals.status, 'active')));
      const [goal] = await tx.insert(productGoals).values({ id: `goal_${randomUUID()}`, projectId, statement, status }).returning();
      return goal;
    });
  }

  async setGoalStatus(goalId: string, status: 'proposed' | 'active' | 'achieved' | 'abandoned') {
    return this.db.transaction(async tx => {
      const [goal] = await tx.select().from(productGoals).where(eq(productGoals.id, goalId));
      if (!goal) throw new Error('Product Goal not found');
      if (status === 'active') await tx.update(productGoals).set({ status: 'abandoned', updatedAt: new Date() }).where(and(eq(productGoals.projectId, goal.projectId), eq(productGoals.status, 'active')));
      const [updated] = await tx.update(productGoals).set({ status, updatedAt: new Date() }).where(eq(productGoals.id, goalId)).returning();
      return updated;
    });
  }

  features(projectId: string) { return this.db.select().from(features).where(eq(features.projectId, projectId)).orderBy(asc(features.name)); }

  async createFeature(projectId: string, input: { name: string; description?: string; status?: 'proposed' | 'active' | 'deprecated' | 'retired' }) {
    const identity = randomUUID();
    const [feature] = await this.db.insert(features).values({ id: `feature_${identity}`, projectId, slug: durableSlug(input.name, identity), name: input.name, description: input.description ?? '', status: input.status ?? 'active' }).returning();
    return feature;
  }

  async linkFeature(featureId: string, workstreamId: string) {
    const [link] = await this.db.insert(featureDeliveryCases).values({ featureId, workstreamId }).onConflictDoNothing().returning();
    return link ?? { featureId, workstreamId };
  }

  async updateDefinitionOfDone(projectId: string, definitionOfDone: string) {
    const [product] = await this.db.update(projects).set({ definitionOfDone }).where(eq(projects.id, projectId)).returning();
    if (!product) throw new Error('Product not found');
    return product;
  }
}
