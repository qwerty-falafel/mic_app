import { bigint, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';

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

export type Project = typeof projects.$inferSelect;
export type Repository = typeof repositories.$inferSelect;
export type WorkItem = typeof workItems.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Question = typeof questions.$inferSelect;
