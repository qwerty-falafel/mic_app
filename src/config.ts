export interface MicConfig {
  databaseUrl: string;
  host: string;
  port: number;
}

export function loadConfig(env = process.env): MicConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const port = Number(env.PORT ?? 3100);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid TCP port');
  return { databaseUrl, host: env.HOST ?? '127.0.0.1', port };
}
