import { createApp } from './api.js';
import type { MicConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { migrateDatabase } from './db/migrate.js';
import { OutboxRuntime } from './dispatcher.js';
import { ProjectExecutionService } from './services/project-execution.js';

export async function startMic(config: MicConfig) {
  const { db, pool } = createDatabase(config.databaseUrl);
  await migrateDatabase(db);
  const runtime = new OutboxRuntime(db, config.databaseUrl);
  await runtime.start();
  const timer = setInterval(() => runtime.dispatchBatch().catch(error => console.error('outbox:', error)), 250);
  const executor = new ProjectExecutionService(db, process.env.MIC_MODEL ?? 'llama.cpp/gpt-oss-120b-F16');
  const app = createApp(db, executor, undefined, { webSecurity: config.webSecurity });
  await app.listen({ host: config.host, port: config.port });
  const visibleOrigin = config.webSecurity.mode === 'remote' ? config.webSecurity.publicOrigin : `http://${config.host}:${config.port}`;
  console.log(`MIC ready: ${visibleOrigin} (local listener: http://${config.host}:${config.port})`);
  let stopping = false;
  return { app, async stop() { if (stopping) return; stopping = true; clearInterval(timer); await app.close(); await runtime.stop(); await pool.end(); } };
}
