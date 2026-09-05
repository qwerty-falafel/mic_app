import { createApp } from './api.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { migrateDatabase } from './db/migrate.js';
import { OutboxRuntime } from './dispatcher.js';

const config = loadConfig();
const { db, pool } = createDatabase(config.databaseUrl);
await migrateDatabase(db);
const runtime = new OutboxRuntime(db, config.databaseUrl);
await runtime.start();
const timer = setInterval(() => runtime.dispatchBatch().catch(error => console.error('outbox:', error)), 250);
const app = createApp(db);

async function shutdown() {
  clearInterval(timer);
  await app.close();
  await runtime.stop();
  await pool.end();
}
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
await app.listen({ host: config.host, port: config.port });
