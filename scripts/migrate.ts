import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db/client.js';
import { migrateDatabase } from '../src/db/migrate.js';

const { databaseUrl } = loadConfig();
const { db, pool } = createDatabase(databaseUrl);
try { await migrateDatabase(db); } finally { await pool.end(); }
