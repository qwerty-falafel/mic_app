import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { epicFeatures, features, productBacklogItems, productBriefs, productEpics, productProposals, projects, proposalDecisions } from '../db/schema.js';
import { durableSlug } from './slugs.js';

export type ProposalShape = {
  rationale: string;
  features: Array<{ name: string; description?: string }>;
  epics: Array<{ name: string; outcome?: string; featureNames?: string[] }>;
  items: Array<{ kind: 'story' | 'defect' | 'discovery'; title: string; value: string; acceptanceCriteria?: string[]; featureName?: string; epicName?: string }>;
  dependencies?: string[];
  uncertainties?: string[];
  deliveryRecommendation: { path: 'direct' | 'spec-epic' | 'project'; rationale: string; evidence: string[]; nextArtifact: string };
};
export interface ProductProposalAnalyzer { analyse(context: { product: any; brief: any; previous?: any; feedback?: string }): Promise<ProposalShape>; }

export class GptOssProposalAnalyzer implements ProductProposalAnalyzer {
  constructor(private readonly endpoint = process.env.MIC_MODEL_ROUTER_URL ?? 'http://127.0.0.1:10000/v1/chat/completions', private readonly model = process.env.MIC_MODEL ?? 'llama.cpp/gpt-oss-120b-F16') {}
  async analyse(context: { product: any; brief: any; previous?: any; feedback?: string }) {
    const instruction = `Return JSON only. Act as a product discovery partner. Turn the Brief into a conservative proposal with this shape: {"rationale":"", "features":[{"name":"","description":""}], "epics":[{"name":"","outcome":"","featureNames":[]}], "items":[{"kind":"story|defect|discovery","title":"","value":"","acceptanceCriteria":[],"featureName":"","epicName":""}], "dependencies":[], "uncertainties":[], "deliveryRecommendation":{"path":"direct|spec-epic|project","rationale":"","evidence":[],"nextArtifact":""}}. Recommend direct only for one already-bounded implementation unit, spec-epic for coherent work needing SPEC.md and stories.yaml, and project only when multiple Epics justify BMAD product/UX/architecture/readiness work. A Story delivers user value; a Defect removes a barrier to intended value; a Discovery closes a consequential understanding gap. Do not create implementation tasks and do not claim BMAD readiness. Product: ${JSON.stringify(context.product)}. Brief: ${JSON.stringify(context.brief)}. Previous proposal: ${JSON.stringify(context.previous ?? null)}. Revision feedback: ${context.feedback ?? 'none'}.`;
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: instruction }], temperature: 0.2 }), signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Proposal model failed (${response.status})`);
    const body: any = await response.json();
    const content = body.choices?.[0]?.message?.content ?? body.output_text;
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Proposal model returned no JSON object');
    return JSON.parse(match[0]) as ProposalShape;
  }
}

export class ProductProposalService {
  constructor(private readonly db: Database, private readonly analyzer: ProductProposalAnalyzer, private readonly model = process.env.MIC_MODEL ?? 'llama.cpp/gpt-oss-120b-F16') {}
  listBriefs(projectId: string) { return this.db.select().from(productBriefs).where(eq(productBriefs.projectId, projectId)).orderBy(desc(productBriefs.createdAt)); }
  listProposals(briefId: string) { return this.db.select().from(productProposals).where(eq(productProposals.briefId, briefId)).orderBy(desc(productProposals.revision)); }
  async createBrief(projectId: string, title: string, content: string) { const [row] = await this.db.insert(productBriefs).values({ id: `brief_${randomUUID()}`, projectId, title, content, status: 'draft' }).returning(); return row!; }
  async analyse(briefId: string, feedback?: string) {
    const [brief] = await this.db.select().from(productBriefs).where(eq(productBriefs.id, briefId));
    if (!brief) throw new Error('Brief not found');
    const [product] = await this.db.query.projects.findMany({ where: (table, { eq }) => eq(table.id, brief.projectId), limit: 1 });
    const previous = (await this.listProposals(briefId))[0];
    await this.db.update(productBriefs).set({ status: 'analysing', updatedAt: new Date() }).where(eq(productBriefs.id, briefId));
    try {
      const proposal = await this.analyzer.analyse({ product, brief, previous: previous?.proposal, feedback });
      if (!proposal.deliveryRecommendation || !['direct', 'spec-epic', 'project'].includes(proposal.deliveryRecommendation.path) || !proposal.deliveryRecommendation.rationale?.trim()) throw new Error('Proposal must include an explained BMAD delivery recommendation');
      const revision = (previous?.revision ?? 0) + 1;
      const [row] = await this.db.insert(productProposals).values({ id: `proposal_${randomUUID()}`, briefId, revision, status: 'proposed', model: this.model, rationale: proposal.rationale, proposal, feedback }).returning();
      await this.db.update(productBriefs).set({ status: 'proposed', updatedAt: new Date() }).where(eq(productBriefs.id, briefId));
      return row!;
    } catch (error) {
      await this.db.update(productBriefs).set({ status: 'failed', updatedAt: new Date() }).where(eq(productBriefs.id, briefId));
      throw error;
    }
  }
  async decide(proposalId: string, kind: 'accepted' | 'revision-requested' | 'rejected', actor: string, feedback?: string) {
    const [proposal] = await this.db.select().from(productProposals).where(eq(productProposals.id, proposalId));
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'proposed') throw new Error('This proposal revision has already been decided');
    return this.db.transaction(async tx => {
      const [decision] = await tx.insert(proposalDecisions).values({ id: `proposal_decision_${randomUUID()}`, proposalId, kind, actor, feedback }).returning();
      await tx.update(productProposals).set({ status: kind }).where(and(eq(productProposals.id, proposalId), eq(productProposals.status, 'proposed')));
      const [brief] = await tx.select().from(productBriefs).where(eq(productBriefs.id, proposal.briefId));
      if (!brief) throw new Error('Brief not found');
      if (kind === 'accepted') await this.apply(tx as any, brief, proposal.id, proposal.proposal as ProposalShape);
      await tx.update(productBriefs).set({ status: kind, updatedAt: new Date() }).where(eq(productBriefs.id, brief.id));
      return decision!;
    });
  }
  private async apply(tx: Database, brief: typeof productBriefs.$inferSelect, proposalId: string, proposal: ProposalShape) {
    const projectId = brief.projectId;
    const featureMap = new Map<string, string>();
    for (const candidate of proposal.features ?? []) {
      let [row] = await tx.select().from(features).where(and(eq(features.projectId, projectId), eq(features.name, candidate.name))).limit(1);
      if (!row) { const identity = randomUUID(); [row] = await tx.insert(features).values({ id: `feature_${identity}`, projectId, slug: durableSlug(candidate.name, identity), name: candidate.name, description: candidate.description ?? '', status: 'proposed' }).returning(); }
      featureMap.set(candidate.name, row!.id);
    }
    const epicMap = new Map<string, string>();
    for (const candidate of proposal.epics ?? []) {
      let [row] = await tx.select().from(productEpics).where(and(eq(productEpics.projectId, projectId), eq(productEpics.name, candidate.name))).limit(1);
      if (!row) { const identity = randomUUID(); [row] = await tx.insert(productEpics).values({ id: `epic_${identity}`, projectId, sourceBriefId: brief.id, sourceProposalId: proposalId, deliveryPath: proposal.deliveryRecommendation.path, deliveryRationale: proposal.deliveryRecommendation.rationale, slug: durableSlug(candidate.name, identity), name: candidate.name, outcome: candidate.outcome ?? '', status: 'proposed' }).returning(); }
      epicMap.set(candidate.name, row!.id);
      for (const featureName of candidate.featureNames ?? []) { const featureId = featureMap.get(featureName); if (featureId) await tx.insert(epicFeatures).values({ epicId: row!.id, featureId }).onConflictDoNothing(); }
    }
    const existing = await tx.select().from(productBacklogItems).where(eq(productBacklogItems.projectId, projectId)).orderBy(asc(productBacklogItems.order));
    let order = existing.length ? Math.max(...existing.map(row => row.order)) + 1 : 0;
    const [product] = await tx.select().from(projects).where(eq(projects.id, projectId));
    const prefix = product!.slug.split('-').slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P';
    for (const item of proposal.items ?? []) await tx.insert(productBacklogItems).values({ id: `pbi_${randomUUID()}`, projectId, sourceProposalId: proposalId, deliveryPath: proposal.deliveryRecommendation.path, deliveryRationale: proposal.deliveryRecommendation.rationale, reference: `${prefix}-${order + 1}`, featureId: item.featureName ? featureMap.get(item.featureName) : undefined, epicId: item.epicName ? epicMap.get(item.epicName) : undefined, kind: item.kind, title: item.title, value: item.value, description: item.value, acceptanceCriteria: item.acceptanceCriteria ?? [], status: 'proposed', order: order++ });
  }
}
