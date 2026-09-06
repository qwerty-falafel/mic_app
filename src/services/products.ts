import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { featureDeliveryCases, features, productGoals, projects } from '../db/schema.js';
import { durableSlug } from './slugs.js';

export class ProductService {
  constructor(private readonly db: Database) {}

  async getByReference(reference: string) {
    const [product] = await this.db.select().from(projects).where(eq(projects.id, reference)).limit(1);
    if (product) return product;
    const [bySlug] = await this.db.select().from(projects).where(eq(projects.slug, reference)).limit(1);
    return bySlug;
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
