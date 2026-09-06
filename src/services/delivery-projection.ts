import { createHash } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { artifactRevisions, featureDeliveryCases, features, integrationDecisions, reviewDecisions, storyUnits, workflowSessions, workstreams } from '../db/schema.js';

export type StageState = 'not-started' | 'ready' | 'active' | 'awaiting-decision' | 'blocked' | 'complete' | 'superseded' | 'needs-attention';
export type DeliveryAction = { id: string; label: string; description: string; eligible: boolean; reason?: string; transition: string; operation?: { skill: string; action?: string } };

const templates: Record<string, { id: string; label: string }[]> = {
  undecided: [
    { id: 'brief', label: 'Brief' }, { id: 'classification', label: 'Choose approach' },
  ],
  direct: [
    { id: 'brief', label: 'Brief' }, { id: 'build', label: 'Build change' }, { id: 'review', label: 'Review Increment' }, { id: 'integration', label: 'Integrate' },
  ],
  'spec-epic': [
    { id: 'brief', label: 'Brief' }, { id: 'specification', label: 'Specification' }, { id: 'story-plan', label: 'Story plan' }, { id: 'delivery', label: 'Deliver Stories' }, { id: 'epic-review', label: 'Review Epic' }, { id: 'integration', label: 'Integrate' },
  ],
  project: [
    { id: 'brief', label: 'Brief' }, { id: 'product-planning', label: 'Product planning' }, { id: 'solution-planning', label: 'UX and architecture' }, { id: 'epics-stories', label: 'Epics and Stories' }, { id: 'bmad-tracking', label: 'BMAD tracking' }, { id: 'delivery', label: 'Deliver PBIs' }, { id: 'review', label: 'Review Increments' },
  ],
  specialist: [
    { id: 'brief', label: 'Brief' }, { id: 'specialist', label: 'Specialist work' }, { id: 'review', label: 'Review outcome' },
  ],
};

function stageForSkill(skill?: string) {
  if (!skill) return undefined;
  if (skill === 'bmad-spec') return 'specification';
  if (skill === 'bmad-create-epics-and-stories' || skill === 'bmad-sprint-planning') return skill === 'bmad-sprint-planning' ? 'bmad-tracking' : 'epics-stories';
  if (skill === 'bmad-product-brief' || skill === 'bmad-prd') return 'product-planning';
  if (skill === 'bmad-ux' || skill === 'bmad-architecture') return 'solution-planning';
  if (skill === 'bmad-build' || skill === 'bmad-build-auto') return 'delivery';
  if (skill === 'bmad-code-review' || skill === 'bmad-walkthrough') return 'review';
  if (skill === 'bmad-retrospective') return 'epic-review';
  if (skill === 'bmad-deep-recon' || skill === 'bmad-review' || skill === 'bmad-correct-course') return 'specialist';
  return undefined;
}

const action = (id: string, label: string, description: string, transition: string, operation?: { skill: string; action?: string }, eligible = true, reason?: string): DeliveryAction => ({ id, label, description, transition, operation, eligible, ...(reason ? { reason } : {}) });

export class DeliveryProjectionService {
  constructor(private readonly db: Database) {}

  async get(workstreamId: string) {
    const [stream] = await this.db.select().from(workstreams).where(eq(workstreams.id, workstreamId));
    if (!stream) throw new Error('Delivery Case not found');
    const [sessions, artifacts, stories, integrations, featureLinks] = await Promise.all([
      this.db.select().from(workflowSessions).where(eq(workflowSessions.workstreamId, workstreamId)).orderBy(desc(workflowSessions.createdAt)),
      this.db.select().from(artifactRevisions).where(eq(artifactRevisions.workstreamId, workstreamId)).orderBy(desc(artifactRevisions.createdAt)),
      this.db.select().from(storyUnits).where(eq(storyUnits.workstreamId, workstreamId)),
      this.db.select().from(integrationDecisions).where(eq(integrationDecisions.workstreamId, workstreamId)).orderBy(desc(integrationDecisions.createdAt)),
      this.db.select({ feature: features }).from(featureDeliveryCases).innerJoin(features, eq(featureDeliveryCases.featureId, features.id)).where(eq(featureDeliveryCases.workstreamId, workstreamId)),
    ]);
    const latestByPath = new Map<string, typeof artifactRevisions.$inferSelect>();
    for (const artifact of artifacts) if (!latestByPath.has(artifact.path)) latestByPath.set(artifact.path, artifact);
    const latest = [...latestByPath.values()];
    const latestIds = latest.map(value => value.id);
    const decisions = latestIds.length ? await this.db.select().from(reviewDecisions).where(and(inArray(reviewDecisions.artifactRevisionId, latestIds), eq(reviewDecisions.kind, 'accepted'))) : [];
    const accepted = new Set(decisions.map(value => value.artifactRevisionId));
    const valid = (artifact: typeof artifactRevisions.$inferSelect) => artifact.status !== 'quarantined' && (artifact.metadata as any)?.valid !== false;
    const spec = latest.find(value => value.type === 'spec' && valid(value));
    const storyInventory = latest.find(value => value.type === 'story-inventory' && valid(value));
    const invalid = latest.find(value => !valid(value));
    const active = sessions.find(value => ['QUEUED', 'RESOURCE_WAITING', 'RUNNING', 'WAITING_FOR_INPUT', 'BLOCKED', 'PAUSED', 'INTERRUPTED', 'NEEDS_CLASSIFICATION'].includes(value.status));
    const integrated = integrations.some(value => value.status === 'integrated') || stream.status === 'COMPLETED';
    const unfinished = stories.filter(value => !['done', 'complete', 'completed'].includes(value.status));

    let currentId = stream.path === 'undecided' ? 'classification' : stream.path === 'direct' ? 'build' : stream.path === 'spec-epic' ? 'specification' : stream.path === 'project' ? 'product-planning' : 'specialist';
    let state: StageState = 'ready';
    let reason = stream.path === 'undecided' ? 'The Brief needs a delivery approach before planning or Build begins.' : 'This is the next valid activity for the selected delivery approach.';
    let attention: Record<string, unknown> | null = null;

    if (integrated) { currentId = 'integration'; state = 'complete'; reason = 'The accepted result has been integrated.'; }
    else if (invalid) { currentId = stageForSkill(active?.skill) ?? (invalid.type === 'spec' ? 'specification' : currentId); state = 'needs-attention'; reason = `The current ${invalid.path} revision is invalid and must be corrected.`; attention = { type: 'artifact', id: invalid.id, label: invalid.path }; }
    else if (active) {
      currentId = stageForSkill(active.skill) ?? currentId;
      state = active.status === 'WAITING_FOR_INPUT' ? 'awaiting-decision' : active.status === 'BLOCKED' ? 'blocked' : active.status === 'PAUSED' || active.status === 'INTERRUPTED' || active.status === 'NEEDS_CLASSIFICATION' ? 'needs-attention' : 'active';
      reason = state === 'active' ? `${active.skill} is ${active.status.toLowerCase().replaceAll('_', ' ')}; no response is required yet.` : `${active.skill} requires attention before it can continue.`;
      attention = { type: 'session', id: active.id, label: active.skill, status: active.status };
    } else if (stream.path === 'spec-epic') {
      if (!spec) { currentId = 'specification'; reason = 'A valid SPEC.md has not been created yet.'; }
      else if (!accepted.has(spec.id)) { currentId = 'specification'; state = 'awaiting-decision'; reason = 'The latest valid specification needs acceptance or revision feedback.'; attention = { type: 'artifact', id: spec.id, label: spec.path }; }
      else if (!storyInventory) { currentId = 'story-plan'; reason = 'The specification is accepted and ready to be refined into an ordered Story plan.'; }
      else if (!stories.length) { currentId = 'story-plan'; reason = 'A valid stories.yaml exists and is ready to be indexed.'; attention = { type: 'artifact', id: storyInventory.id, label: storyInventory.path }; }
      else if (unfinished.length) { currentId = 'delivery'; reason = `${unfinished.length} of ${stories.length} Stories still need delivery.`; }
      else { currentId = 'epic-review'; reason = 'All Stories are complete; inspect the Epic outcome before integration.'; }
    }

    const baseActions: DeliveryAction[] = [];
    if (attention?.type === 'session') {
      if (active?.status === 'PAUSED' || active?.status === 'INTERRUPTED') baseActions.push(action('resume-session', 'Resume conversation', 'Continue from the preserved provider checkpoint.', currentId, undefined));
      else baseActions.push(action('open-session', state === 'active' ? 'View conversation' : 'Answer BMAD', state === 'active' ? 'Follow the current run without sending input.' : 'Read the exact question and respond in the same session.', currentId));
    } else if (attention?.type === 'artifact') baseActions.push(action('review-artifact', invalid ? 'Correct artifact' : 'Review specification', invalid ? 'Inspect validation problems and request a corrected revision.' : 'Accept this exact revision or request specific changes.', invalid ? currentId : 'story-plan'));
    else if (stream.path === 'undecided') baseActions.push(action('choose-path', 'Choose delivery approach', 'Review the Brief and choose the BMAD path that fits its size and uncertainty.', 'classification', { skill: 'bmad-help' }));
    else if (stream.path === 'spec-epic' && !spec) baseActions.push(action('create-specification', 'Create specification', 'Turn the Brief into a concise implementation contract for this Epic.', 'specification', { skill: 'bmad-spec' }));
    else if (stream.path === 'spec-epic' && spec && accepted.has(spec.id) && !storyInventory) baseActions.push(action('create-story-plan', 'Create Story plan', 'Refine the accepted specification into ordered, bounded Stories.', 'story-plan', { skill: 'bmad-spec', action: 'create-stories' }));
    else if (stream.path === 'spec-epic' && storyInventory && !stories.length) baseActions.push(action('index-stories', 'Open Story plan', 'Index and display the validated Story inventory.', 'delivery'));
    else if (stream.path === 'spec-epic' && stories.length && unfinished.length) baseActions.push(action('deliver-story', 'Deliver next Story', 'Open the first eligible Story and choose attended Build or Build Auto.', 'delivery'));
    else if (stream.path === 'spec-epic' && stories.length) baseActions.push(action('review-epic', 'Review Epic outcome', 'Inspect evidence and run the BMAD Epic Retrospective.', 'epic-review', { skill: 'bmad-retrospective' }));
    else if (stream.path === 'direct') baseActions.push(action('build-change', 'Build change', 'Start one bounded attended Build session.', 'review', { skill: 'bmad-build' }));
    else if (stream.path === 'project') baseActions.push(action('continue-project-planning', 'Continue product planning', 'Run the next eligible BMAD planning workflow.', currentId));
    else baseActions.push(action('start-specialist-work', 'Start specialist work', 'Choose the focused research, review, or correction operation.', 'review'));

    const readStoriesEligible = Boolean(storyInventory);
    const alternatives: DeliveryAction[] = [
      action('index-stories', 'Open Story plan', 'Read the current stories.yaml inventory.', 'delivery', undefined, readStoriesEligible, readStoriesEligible ? undefined : 'A valid stories.yaml revision does not exist yet.'),
      action('advanced-actions', 'Advanced actions', 'Inspect every eligible installed BMAD operation and its prerequisites.', currentId),
    ];
    const template = templates[stream.path] ?? templates.undecided!;
    const currentIndex = Math.max(0, template.findIndex(value => value.id === currentId));
    const stages = template.map((value, index) => ({ ...value, state: (index < currentIndex ? 'complete' : index === currentIndex ? state : 'not-started') as StageState }));
    const versionData = { workstreamId, updatedAt: stream.updatedAt, sessions: sessions.map(value => [value.id, value.status, value.updatedAt]), artifacts: latest.map(value => [value.id, value.status, value.contentHash]), stories: stories.map(value => [value.id, value.status, value.updatedAt]), integrations: integrations.map(value => value.id) };
    const actionToken = createHash('sha256').update(JSON.stringify(versionData)).digest('hex');
    return {
      delivery: { id: stream.id, slug: stream.slug, title: stream.title, summary: stream.summary, brief: stream.intent, classification: stream.classification, path: stream.path, status: stream.status, branch: stream.branch, workspacePath: stream.workspacePath },
      features: featureLinks.map(value => value.feature), stages, currentStage: stages[currentIndex], reason, attention,
      recommendedAction: baseActions[0] ?? null, alternativeActions: alternatives, actionToken,
    };
  }

  async validate(workstreamId: string, actionId: string, token: string) {
    const projection = await this.get(workstreamId);
    if (projection.actionToken !== token) throw new Error('Delivery state changed; refresh before continuing');
    const candidate = [projection.recommendedAction, ...projection.alternativeActions].find(value => value?.id === actionId);
    if (!candidate) throw new Error('Action is not available in the current stage');
    if (!candidate.eligible) throw new Error(candidate.reason ?? 'Action prerequisites are not met');
    return { action: candidate, actionToken: projection.actionToken };
  }
}
