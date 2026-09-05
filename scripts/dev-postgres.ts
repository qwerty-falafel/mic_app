import EmbeddedPostgres from 'embedded-postgres';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const port = Number(process.env.MIC_DB_PORT ?? 54329);
const databaseDir = resolve('.runtime/postgres');
const postgres = new EmbeddedPostgres({ databaseDir, port, user: 'postgres', password: 'mic', persistent: true });
if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await postgres.initialise();
await postgres.start();
console.log(`MIC PostgreSQL ready: postgres://postgres:mic@127.0.0.1:${port}/postgres`);
const stop = async () => { await postgres.stop(); process.exit(0); };
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
await new Promise(() => {});
