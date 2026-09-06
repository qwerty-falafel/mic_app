import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const projects = pgTable('projects', {
  id: text('id').primaryKey(), commandKey: text('command_key').notNull().unique(), name: text('name').notNull(), createdAt: createdAt(),
});

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
  legacyWorkItemId: text('legacy_work_item_id').references(() => workItems.id, { onDelete: 'set null' }), title: text('title').notNull(), intent: text('intent').notNull(), path: text('path').notNull().default('undecided'), status: text('status').notNull().default('ACTIVE'),
  workspacePath: text('workspace_path'), branch: text('branch'), baselineRevision: text('baseline_revision'),
  createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('workstreams_project_status_idx').on(table.projectId, table.status)]);

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

export type Project = typeof projects.$inferSelect;
export type Repository = typeof repositories.$inferSelect;
export type WorkItem = typeof workItems.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Question = typeof questions.$inferSelect;
