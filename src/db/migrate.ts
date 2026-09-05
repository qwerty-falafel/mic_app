import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client.js';

export async function migrateDatabase(db: Database, migrationsFolder = 'drizzle') {
  await migrate(db, { migrationsFolder });
}
