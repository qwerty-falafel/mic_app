import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { resolve } from 'node:path';
import { loadConfig } from '../src/config.js';
import { startMic } from '../src/server.js';

const databasePort = Number(process.env.MIC_DB_PORT ?? 54329);
const databaseUrl = process.env.DATABASE_URL ?? `postgres://postgres:mic@127.0.0.1:${databasePort}/postgres`;
const portIsOpen = () => new Promise<boolean>(done => {
  const socket = connect({ host: '127.0.0.1', port: databasePort });
  socket.setTimeout(300);
  socket.once('connect', () => { socket.destroy(); done(true); });
  socket.once('timeout', () => { socket.destroy(); done(false); });
  socket.once('error', () => done(false));
});

let postgres: EmbeddedPostgres | undefined;
if (!process.env.DATABASE_URL && !await portIsOpen()) {
  const databaseDir = resolve('.runtime/postgres');
  postgres = new EmbeddedPostgres({ databaseDir, port: databasePort, user: 'postgres', password: 'mic', persistent: true, onLog: () => {}, onError: message => console.error('PostgreSQL:', message) });
  if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await postgres.initialise();
  await postgres.start();
  console.log(`PostgreSQL ready: ${databaseUrl}`);
} else console.log(`Using PostgreSQL: ${databaseUrl}`);

let mic: Awaited<ReturnType<typeof startMic>> | undefined;
try { mic = await startMic(loadConfig({ ...process.env, DATABASE_URL: databaseUrl })); }
catch (error) { if (postgres) await postgres.stop(); throw error; }

let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; await mic?.stop(); if (postgres) await postgres.stop(); process.exit(0); };
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
