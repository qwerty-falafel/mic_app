import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { artifactRevisions, epicFeatures, features, goalFeatures, increments, productBacklogItems, productBriefs, productEpics, productGoals, productProposals, scrumSprints, sprintBacklogItems, storyUnits, workflowSessions, workstreams } from '../db/schema.js';

export class ProductTraceService {
  constructor(private readonly db: Database) {}

  async backlogItem(itemId: string) {
    const [item] = await this.db.select().from(productBacklogItems).where(eq(productBacklogItems.id, itemId));
    if (!item) throw new Error('Product Backlog Item not found');
    const [[feature], [epic], [delivery], [story], [proposal], memberships] = await Promise.all([
      item.featureId ? this.db.select().from(features).where(eq(features.id, item.featureId)) : [],
      item.epicId ? this.db.select().from(productEpics).where(eq(productEpics.id, item.epicId)) : [],
      item.workstreamId ? this.db.select().from(workstreams).where(eq(workstreams.id, item.workstreamId)) : [],
      item.storyUnitId ? this.db.select().from(storyUnits).where(eq(storyUnits.id, item.storyUnitId)) : [],
      item.sourceProposalId ? this.db.select().from(productProposals).where(eq(productProposals.id, item.sourceProposalId)) : [],
      this.db.select().from(sprintBacklogItems).where(eq(sprintBacklogItems.backlogItemId, item.id)),
    ]);
    const [brief] = proposal ? await this.db.select().from(productBriefs).where(eq(productBriefs.id, proposal.briefId)) : [];
    const artifactId = item.sourceArtifactId ?? story?.parentArtifactId;
    const [artifact] = artifactId ? await this.db.select().from(artifactRevisions).where(eq(artifactRevisions.id, artifactId)) : [];
    const sessions = story ? await this.db.select().from(workflowSessions).where(eq(workflowSessions.storyUnitId, story.id)) : [];
    const sprintIds = memberships.map(row => row.sprintId);
    const sprints = sprintIds.length ? await this.db.select().from(scrumSprints).where(inArray(scrumSprints.id, sprintIds)) : [];
    const productIncrements = sprintIds.length ? await this.db.select().from(increments).where(inArray(increments.sprintId, sprintIds)) : [];
    const featureIds = new Set<string>([item.featureId, ...(epic ? (await this.db.select().from(epicFeatures).where(eq(epicFeatures.epicId, epic.id))).map(row => row.featureId) : [])].filter(Boolean) as string[]);
    const relatedFeatures = featureIds.size ? await this.db.select().from(features).where(inArray(features.id, [...featureIds])) : [];
    const links = featureIds.size ? await this.db.select().from(goalFeatures).where(inArray(goalFeatures.featureId, [...featureIds])) : [];
    const goals = links.length ? await this.db.select().from(productGoals).where(inArray(productGoals.id, links.map(row => row.goalId))) : [];
    return { item, brief: brief ?? null, proposal: proposal ?? null, goals, features: relatedFeatures, epic: epic ?? null, delivery: delivery ?? null, bmad: { story: story ?? null, artifact: artifact ?? null, sessions }, scrum: { sprints, increments: productIncrements }, authorities: { backlogOrder: 'MIC/Scrum', sprintMembership: 'MIC/Scrum', boardStatus: 'MIC/Jira pattern', planningAndBuild: 'BMAD', humanApproval: 'MIC' } };
  }
}
