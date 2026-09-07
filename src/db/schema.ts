import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const projects = pgTable('projects', {
  id: text('id').primaryKey(), commandKey: text('command_key').notNull().unique(), name: text('name').notNull(), slug: text('slug').notNull().unique(),
  purpose: text('purpose').notNull().default(''), status: text('status').notNull().default('active'),
  definitionOfDone: text('definition_of_done').notNull().default('The accepted outcome is integrated, usable, verified against its acceptance criteria, and supported by recorded evidence.'), createdAt: createdAt(),
});

export const productGoals = pgTable('product_goals', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), statement: text('statement').notNull(), status: text('status').notNull().default('proposed'), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('product_goals_project_status_idx').on(table.projectId, table.status)]);

export const features = pgTable('features', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), slug: text('slug').notNull(), name: text('name').notNull(), description: text('description').notNull().default(''), status: text('status').notNull().default('active'), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('features_project_slug_idx').on(table.projectId, table.slug), index('features_project_status_idx').on(table.projectId, table.status)]);

export const productEpics = pgTable('product_epics', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), slug: text('slug').notNull(), name: text('name').notNull(), outcome: text('outcome').notNull().default(''), status: text('status').notNull().default('proposed'), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('product_epics_project_slug_idx').on(table.projectId, table.slug), index('product_epics_project_status_idx').on(table.projectId, table.status)]);

export const goalFeatures = pgTable('goal_features', {
  goalId: text('goal_id').notNull().references(() => productGoals.id, { onDelete: 'cascade' }), featureId: text('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }), createdAt: createdAt(),
}, table => [uniqueIndex('goal_feature_idx').on(table.goalId, table.featureId)]);

export const epicFeatures = pgTable('epic_features', {
  epicId: text('epic_id').notNull().references(() => productEpics.id, { onDelete: 'cascade' }), featureId: text('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }), createdAt: createdAt(),
}, table => [uniqueIndex('epic_feature_idx').on(table.epicId, table.featureId), index('epic_feature_feature_idx').on(table.featureId)]);

export const productBriefs = pgTable('product_briefs', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), title: text('title').notNull(), content: text('content').notNull(), status: text('status').notNull().default('draft'), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('product_briefs_project_idx').on(table.projectId, table.createdAt)]);

export const productProposals = pgTable('product_proposals', {
  id: text('id').primaryKey(), briefId: text('brief_id').notNull().references(() => productBriefs.id, { onDelete: 'cascade' }), revision: integer('revision').notNull(), status: text('status').notNull().default('proposed'), model: text('model').notNull(), rationale: text('rationale').notNull(), proposal: jsonb('proposal').notNull(), feedback: text('feedback'), createdAt: createdAt(),
}, table => [uniqueIndex('product_proposal_brief_revision_idx').on(table.briefId, table.revision), index('product_proposal_status_idx').on(table.status)]);

export const proposalDecisions = pgTable('proposal_decisions', {
  id: text('id').primaryKey(), proposalId: text('proposal_id').notNull().references(() => productProposals.id, { onDelete: 'cascade' }), kind: text('kind').notNull(), feedback: text('feedback'), actor: text('actor').notNull(), createdAt: createdAt(),
}, table => [uniqueIndex('proposal_decision_once_idx').on(table.proposalId)]);

export const repositories = pgTable('repositories', {
  id: text('id').primaryKey(), commandKey: text('command_key').notNull().unique(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('primary'), path: text('path').notNull(), baseBranch: text('base_branch').notNull().default('main'), createdAt: createdAt(),
}, table => [index('repositories_project_idx').on(table.projectId), unique('repositories_project_path_unique').on(table.projectId, table.path)]);

export const workItems = pgTable('work_items', {
  id: text('id').primaryKey(), commandKey: text('command_key').notNull().unique(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('development'), title: text('title').notNull(), intent: text('intent').notNull(), state: text('state').notNull().default('INTAKE'),
  priority: integer('priority').notNull().default(0), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('work_items_project_state_idx').on(table.projectId, table.state)]);

export const runs = pgTable('runs', {
  id: text('id').primaryKey(), commandKey: text('command_key').notNull().unique(), workItemId: text('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), model: text('model'), status: text('status').notNull().default('QUEUED'), baselineRevision: text('baseline_revision'), resultRevision: text('result_revision'),
  result: jsonb('result'), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('runs_work_item_status_idx').on(table.workItemId, table.status)]);

export const questions = pgTable('questions', {
  id: text('id').primaryKey(), commandKey: text('command_key').notNull().unique(), workItemId: text('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  runId: text('run_id').references(() => runs.id, { onDelete: 'set null' }), question: text('question').notNull(), context: jsonb('context').notNull().default({}), resumeRef: jsonb('resume_ref'),
  status: text('status').notNull().default('OPEN'), answer: text('answer'), createdAt: createdAt(), answeredAt: timestamp('answered_at', { withTimezone: true }),
}, table => [index('questions_work_item_status_idx').on(table.workItemId, table.status)]);

export const auditEvents = pgTable('audit_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(), aggregateType: text('aggregate_type').notNull(), aggregateId: text('aggregate_id').notNull(),
  action: text('action').notNull(), actor: text('actor').notNull(), detail: jsonb('detail').notNull().default({}), idempotencyKey: text('idempotency_key').notNull().unique(), createdAt: createdAt(),
}, table => [index('audit_aggregate_idx').on(table.aggregateType, table.aggregateId, table.createdAt)]);

export const outboxEvents = pgTable('outbox_events', {
  id: text('id').primaryKey(), topic: text('topic').notNull(), payload: jsonb('payload').notNull(), idempotencyKey: text('idempotency_key').notNull().unique(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }), attempts: integer('attempts').notNull().default(0), lastError: text('last_error'), createdAt: createdAt(),
}, table => [index('outbox_pending_idx').on(table.createdAt)]);

export const processedEvents = pgTable('processed_events', {
  outboxEventId: text('outbox_event_id').primaryKey().references(() => outboxEvents.id, { onDelete: 'cascade' }), topic: text('topic').notNull(), payload: jsonb('payload').notNull(), processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const discoveryRecords = pgTable('discovery_records', {
  id: text('id').primaryKey(), workItemId: text('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }).unique(), data: jsonb('data').notNull(), createdAt: createdAt(),
});

export const planningArtifacts = pgTable('planning_artifacts', {
  id: text('id').primaryKey(), workItemId: text('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }), runId: text('run_id').references(() => runs.id, { onDelete: 'set null' }),
  path: text('path').notNull(), contentHash: text('content_hash').notNull(), baselineRevision: text('baseline_revision').notNull(), resultRevision: text('result_revision').notNull(), createdAt: createdAt(),
}, table => [uniqueIndex('planning_artifact_revision_idx').on(table.workItemId, table.contentHash)]);

export const technicalRecords = pgTable('technical_records', {
  id: text('id').primaryKey(), workItemId: text('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }).unique(), data: jsonb('data').notNull(), createdAt: createdAt(),
});

export const implementationArtifacts = pgTable('implementation_artifacts', {
  id: text('id').primaryKey(), workItemId: text('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }), runId: text('run_id').references(() => runs.id, { onDelete: 'set null' }),
  path: text('path').notNull(), contentHash: text('content_hash').notNull(), baselineRevision: text('baseline_revision').notNull(), resultRevision: text('result_revision').notNull(), createdAt: createdAt(),
}, table => [uniqueIndex('implementation_artifact_revision_idx').on(table.workItemId, table.contentHash)]);

export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(), workItemId: text('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }), phase: text('phase').notNull(), artifactHash: text('artifact_hash').notNull(),
  artifactType: text('artifact_type').notNull(), repositoryRevision: text('repository_revision').notNull(), approver: text('approver').notNull(), createdAt: createdAt(),
}, table => [uniqueIndex('approval_phase_artifact_idx').on(table.workItemId, table.phase, table.artifactHash)]);

export const evidenceRecords = pgTable('evidence_records', {
  id: text('id').primaryKey(), runId: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }), repositoryId: text('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), revision: text('revision').notNull(), passed: boolean('passed').notNull(), data: jsonb('data').notNull(), createdAt: createdAt(),
}, table => [uniqueIndex('evidence_run_kind_revision_idx').on(table.runId, table.kind, table.revision)]);

export const workstreams = pgTable('workstreams', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), repositoryId: text('repository_id').references(() => repositories.id, { onDelete: 'set null' }),
  legacyWorkItemId: text('legacy_work_item_id').references(() => workItems.id, { onDelete: 'set null' }), slug: text('slug').notNull(), title: text('title').notNull(), intent: text('intent').notNull(), summary: text('summary').notNull().default(''), classification: text('classification').notNull().default('unclassified'), path: text('path').notNull().default('undecided'), status: text('status').notNull().default('ACTIVE'),
  workspacePath: text('workspace_path'), branch: text('branch'), baselineRevision: text('baseline_revision'),
  createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('workstreams_project_status_idx').on(table.projectId, table.status), uniqueIndex('workstreams_project_slug_idx').on(table.projectId, table.slug)]);

export const featureDeliveryCases = pgTable('feature_delivery_cases', {
  featureId: text('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }), workstreamId: text('workstream_id').notNull().references(() => workstreams.id, { onDelete: 'cascade' }), createdAt: createdAt(),
}, table => [uniqueIndex('feature_delivery_case_idx').on(table.featureId, table.workstreamId), index('feature_delivery_workstream_idx').on(table.workstreamId)]);

export const workflowDefinitions = pgTable('workflow_definitions', {
  id: text('id').primaryKey(), repositoryId: text('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }), fingerprint: text('fingerprint').notNull(), module: text('module').notNull(), skill: text('skill').notNull(), displayName: text('display_name').notNull(), phase: text('phase').notNull(), action: text('action'), required: boolean('required').notNull().default(false), metadata: jsonb('metadata').notNull().default({}), createdAt: createdAt(),
}, table => [uniqueIndex('workflow_definition_install_skill_action_idx').on(table.repositoryId, table.fingerprint, table.skill, table.action)]);

export const workflowSessions = pgTable('workflow_sessions', {
  id: text('id').primaryKey(), workstreamId: text('workstream_id').notNull().references(() => workstreams.id, { onDelete: 'cascade' }), definitionId: text('definition_id').references(() => workflowDefinitions.id, { onDelete: 'set null' }), skill: text('skill').notNull(), action: text('action'), args: jsonb('args').notNull().default({}), prompt: text('prompt').notNull(), status: text('status').notNull().default('QUEUED'), providerSessionId: text('provider_session_id'), rawState: jsonb('raw_state').notNull().default({}), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, table => [index('workflow_sessions_workstream_status_idx').on(table.workstreamId, table.status)]);

export const conversationTurns = pgTable('conversation_turns', {
  id: text('id').primaryKey(), sessionId: text('session_id').notNull().references(() => workflowSessions.id, { onDelete: 'cascade' }), sequence: integer('sequence').notNull(), role: text('role').notNull(), content: text('content').notNull(), commandKey: text('command_key'), metadata: jsonb('metadata').notNull().default({}), createdAt: createdAt(),
}, table => [uniqueIndex('conversation_turn_session_sequence_idx').on(table.sessionId, table.sequence), uniqueIndex('conversation_turn_session_command_idx').on(table.sessionId, table.commandKey)]);

export const artifactRevisions = pgTable('artifact_revisions', {
  id: text('id').primaryKey(), workstreamId: text('workstream_id').notNull().references(() => workstreams.id, { onDelete: 'cascade' }), sessionId: text('session_id').references(() => workflowSessions.id, { onDelete: 'set null' }), path: text('path').notNull(), type: text('type').notNull(), status: text('status'), contentHash: text('content_hash').notNull(), content: text('content').notNull(), repositoryRevision: text('repository_revision'), metadata: jsonb('metadata').notNull().default({}), createdAt: createdAt(),
}, table => [uniqueIndex('artifact_revision_workstream_path_hash_idx').on(table.workstreamId, table.path, table.contentHash)]);

export const artifactLinks = pgTable('artifact_links', {
  id: text('id').primaryKey(), fromArtifactId: text('from_artifact_id').notNull().references(() => artifactRevisions.id, { onDelete: 'cascade' }), toArtifactId: text('to_artifact_id').notNull().references(() => artifactRevisions.id, { onDelete: 'cascade' }), relationship: text('relationship').notNull(), createdAt: createdAt(),
}, table => [uniqueIndex('artifact_link_unique_idx').on(table.fromArtifactId, table.toArtifactId, table.relationship)]);

export const reviewDecisions = pgTable('review_decisions', {
  id: text('id').primaryKey(), artifactRevisionId: text('artifact_revision_id').notNull().references(() => artifactRevisions.id, { onDelete: 'cascade' }), kind: text('kind').notNull(), feedback: text('feedback'), actor: text('actor').notNull(), createdAt: createdAt(),
}, table => [index('review_decisions_artifact_idx').on(table.artifactRevisionId, table.createdAt)]);

export const storyUnits = pgTable('story_units', {
  id: text('id').primaryKey(), workstreamId: text('workstream_id').notNull().references(() => workstreams.id, { onDelete: 'cascade' }), storyKey: text('story_key').notNull(), order: integer('order').notNull(), title: text('title').notNull(), description: text('description').notNull().default(''), status: text('status').notNull().default('backlog'), parentArtifactId: text('parent_artifact_id').references(() => artifactRevisions.id, { onDelete: 'set null' }), metadata: jsonb('metadata').notNull().default({}), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(), createdAt: createdAt(),
}, table => [uniqueIndex('story_unit_workstream_key_idx').on(table.workstreamId, table.storyKey), index('story_unit_workstream_order_idx').on(table.workstreamId, table.order)]);

export const integrationDecisions = pgTable('integration_decisions', {
  id: text('id').primaryKey(), workstreamId: text('workstream_id').notNull().references(() => workstreams.id, { onDelete: 'cascade' }), actor: text('actor').notNull(), baseRevision: text('base_revision').notNull(), resultRevision: text('result_revision').notNull(), status: text('status').notNull(), detail: jsonb('detail').notNull().default({}), createdAt: createdAt(),
}, table => [index('integration_decision_workstream_idx').on(table.workstreamId, table.createdAt)]);

export const productBacklogItems = pgTable('product_backlog_items', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), featureId: text('feature_id').references(() => features.id, { onDelete: 'set null' }), epicId: text('epic_id').references(() => productEpics.id, { onDelete: 'set null' }), workstreamId: text('workstream_id').references(() => workstreams.id, { onDelete: 'set null' }), storyUnitId: text('story_unit_id').references(() => storyUnits.id, { onDelete: 'set null' }),
  kind: text('kind').notNull().default('story'), title: text('title').notNull(), description: text('description').notNull().default(''), status: text('status').notNull().default('proposed'), order: integer('order').notNull().default(0), acceptanceCriteria: jsonb('acceptance_criteria').notNull().default([]), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('product_backlog_project_order_idx').on(table.projectId, table.order), uniqueIndex('product_backlog_story_unit_idx').on(table.storyUnitId)]);

export const scrumSprints = pgTable('scrum_sprints', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), number: integer('number').notNull(), goal: text('goal').notNull(), status: text('status').notNull().default('planned'), startsAt: timestamp('starts_at', { withTimezone: true }).notNull(), endsAt: timestamp('ends_at', { withTimezone: true }).notNull(), createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('scrum_sprint_project_number_idx').on(table.projectId, table.number), index('scrum_sprint_project_status_idx').on(table.projectId, table.status)]);

export const sprintBacklogItems = pgTable('sprint_backlog_items', {
  sprintId: text('sprint_id').notNull().references(() => scrumSprints.id, { onDelete: 'cascade' }), backlogItemId: text('backlog_item_id').notNull().references(() => productBacklogItems.id, { onDelete: 'cascade' }), selectedAt: createdAt(),
}, table => [uniqueIndex('sprint_backlog_item_idx').on(table.sprintId, table.backlogItemId), index('sprint_backlog_item_lookup_idx').on(table.backlogItemId)]);

export const increments = pgTable('increments', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), sprintId: text('sprint_id').references(() => scrumSprints.id, { onDelete: 'set null' }), title: text('title').notNull(), description: text('description').notNull().default(''), definitionOfDone: text('definition_of_done').notNull(), evidence: jsonb('evidence').notNull().default({}), createdAt: createdAt(),
}, table => [index('increments_project_idx').on(table.projectId, table.createdAt)]);

export type Project = typeof projects.$inferSelect;
export type Repository = typeof repositories.$inferSelect;
export type WorkItem = typeof workItems.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Question = typeof questions.$inferSelect;
