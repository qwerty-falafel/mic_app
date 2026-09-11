export interface MicConfig {
  databaseUrl: string;
  host: string;
  port: number;
  webSecurity: WebSecurityConfig;
}

export type WebSecurityConfig =
  | { mode: 'local'; allowedOrigins: string[] }
  | { mode: 'remote'; allowedOrigins: string[]; publicOrigin: string; teamDomain: string; audience: string; email: string };

function origin(value: string, name: string) {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be an absolute URL origin`); }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error(`${name} must contain only scheme, host, and optional port`);
  return parsed.origin;
}

export function loadConfig(env = process.env): MicConfig {
  const databaseUrl = env.DATABASE_URL ?? 'postgres://postgres:mic@127.0.0.1:54329/postgres';
  const port = Number(env.PORT ?? 3100);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid TCP port');
  const host = env.HOST ?? '127.0.0.1';
  const mode = env.MIC_DEPLOYMENT_MODE ?? 'local';
  if (mode !== 'local' && mode !== 'remote') throw new Error('MIC_DEPLOYMENT_MODE must be local or remote');
  const configuredOrigins = (env.MIC_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean).map(value => origin(value, 'MIC_ALLOWED_ORIGINS'));
  if (mode === 'local') {
    const allowedOrigins = [...new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...configuredOrigins])];
    return { databaseUrl, host, port, webSecurity: { mode, allowedOrigins } };
  }
  const publicOrigin = origin(env.MIC_PUBLIC_ORIGIN ?? '', 'MIC_PUBLIC_ORIGIN');
  if (!publicOrigin.startsWith('https://')) throw new Error('MIC_PUBLIC_ORIGIN must use HTTPS in remote mode');
  const teamDomain = origin(env.MIC_ACCESS_TEAM_DOMAIN ?? '', 'MIC_ACCESS_TEAM_DOMAIN');
  if (!teamDomain.startsWith('https://') || !new URL(teamDomain).hostname.endsWith('.cloudflareaccess.com')) throw new Error('MIC_ACCESS_TEAM_DOMAIN must be an HTTPS cloudflareaccess.com origin');
  const audience = env.MIC_ACCESS_AUDIENCE?.trim();
  const email = env.MIC_ACCESS_EMAIL?.trim().toLowerCase();
  if (!audience) throw new Error('MIC_ACCESS_AUDIENCE is required in remote mode');
  if (!email || !zEmail(email)) throw new Error('MIC_ACCESS_EMAIL must be a valid email address in remote mode');
  return { databaseUrl, host, port, webSecurity: { mode, publicOrigin, teamDomain, audience, email, allowedOrigins: [publicOrigin, ...configuredOrigins] } };
}

function zEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
