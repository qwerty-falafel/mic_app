import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Database } from './db/client.js';
import { auditEvents, outboxEvents, projects, questions, repositories, runs, workItems } from './db/schema.js';
import { durableSlug } from './services/slugs.js';

type Json = Record<string, unknown>;
type EntityTable = typeof projects | typeof repositories | typeof workItems | typeof runs | typeof questions;

function stableId(prefix: string, commandKey: string) {
  return `${prefix}_${createHash('sha256').update(`${prefix}:${commandKey}`).digest('hex').slice(0, 24)}`;
}

export class Kernel {
  constructor(private readonly db: Database) {}

  private async create<T extends EntityTable>(table: T, prefix: string, commandKey: string, values: Json, actor = 'api') {
    const id = stableId(prefix, commandKey);
    const scopedKey = `${prefix}:${commandKey}`;
    return this.db.transaction(async tx => {
      await tx.insert(table as any).values({ id, commandKey, ...values }).onConflictDoNothing({ target: (table as any).commandKey });
      const [entity] = await tx.select().from(table as any).where(eq((table as any).commandKey, commandKey)).limit(1);
      if (!entity) throw new Error(`Unable to create ${prefix}`);
      const topic = `${prefix}.created`;
      await tx.insert(auditEvents).values({ aggregateType: prefix, aggregateId: (entity as any).id, action: 'created', actor, detail: values, idempotencyKey: `${scopedKey}:audit` }).onConflictDoNothing();
      await tx.insert(outboxEvents).values({ id: stableId('evt', scopedKey), topic, payload: { id: (entity as any).id, ...values }, idempotencyKey: `${scopedKey}:outbox` }).onConflictDoNothing();
      return entity as any;
    });
  }

  createProject(input: { name: string; definitionOfDone?: string }, key: string = randomUUID()) { return this.create(projects, 'project', key, { ...input, slug: durableSlug(input.name, key) }); }
  createRepository(input: { projectId: string; path: string; role?: string; baseBranch?: string }, key: string = randomUUID()) { return this.create(repositories, 'repository', key, input); }
  createWorkItem(input: { projectId: string; title: string; intent: string; kind?: string; state?: string; priority?: number }, key: string = randomUUID()) { return this.create(workItems, 'work_item', key, input); }
  createRun(input: { workItemId: string; kind: string; model?: string; status?: string; baselineRevision?: string }, key: string = randomUUID()) { return this.create(runs, 'run', key, input); }
  createQuestion(input: { workItemId: string; runId?: string; question: string; context?: Json; resumeRef?: Json }, key: string = randomUUID()) { return this.create(questions, 'question', key, input); }

  async get(kind: 'projects' | 'repositories' | 'work-items' | 'runs' | 'questions', id: string) {
    const table = { projects, repositories, 'work-items': workItems, runs, questions }[kind];
    const [row] = await this.db.select().from(table as any).where(eq((table as any).id, id)).limit(1);
    return row as any | undefined;
  }
}
