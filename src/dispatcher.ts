import { sql } from 'drizzle-orm';
import { PgBoss, type Job } from 'pg-boss';
import type { Database } from './db/client.js';
import { processedEvents } from './db/schema.js';

export const OUTBOX_QUEUE = 'mic-outbox';
export interface OutboxJob { outboxEventId: string; topic: string; payload: Record<string, unknown> }

export class OutboxRuntime {
  readonly boss: PgBoss;
  constructor(private readonly db: Database, databaseUrl: string) {
    this.boss = new PgBoss({ connectionString: databaseUrl, schema: 'pgboss' });
    this.boss.on('error', error => console.error('pg-boss:', error));
  }

  async start() {
    await this.boss.start();
    await this.boss.createQueue(OUTBOX_QUEUE, { policy: 'singleton' });
    await this.boss.work<OutboxJob>(OUTBOX_QUEUE, { batchSize: 1 }, async jobs => {
      for (const job of jobs) await this.process(job);
    });
  }

  private async process(job: Job<OutboxJob>) {
    const event = job.data;
    await this.db.insert(processedEvents).values({ outboxEventId: event.outboxEventId, topic: event.topic, payload: event.payload }).onConflictDoNothing();
  }

  async dispatchBatch(limit = 100) {
    const claimed = await this.db.transaction(async tx => {
      const result = await tx.execute(sql`
        SELECT id, topic, payload FROM outbox_events
        WHERE delivered_at IS NULL
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      `);
      const rows = result.rows as Array<{ id: string; topic: string; payload: Record<string, unknown> }>;
      for (const row of rows) {
        const jobId = await this.boss.send(OUTBOX_QUEUE, { outboxEventId: row.id, topic: row.topic, payload: row.payload }, { singletonKey: row.id });
        if (jobId) await tx.execute(sql`UPDATE outbox_events SET delivered_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = ${row.id}`);
      }
      return rows.length;
    });
    return claimed;
  }

  stop() { return this.boss.stop({ graceful: true, timeout: 5000 }); }
}
