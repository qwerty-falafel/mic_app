import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { WebSecurityConfig } from './config.js';

declare module 'fastify' {
  interface FastifyRequest {
    micActor: string;
  }
}

export type AccessVerifier = (token: string) => Promise<JWTPayload>;

export function cloudflareAccessVerifier(config: Extract<WebSecurityConfig, { mode: 'remote' }>): AccessVerifier {
  const jwks = createRemoteJWKSet(new URL(`${config.teamDomain}/cdn-cgi/access/certs`), { timeoutDuration: 5_000, cooldownDuration: 30_000, cacheMaxAge: 600_000 });
  return async token => (await jwtVerify(token, jwks, { issuer: config.teamDomain, audience: config.audience, algorithms: ['RS256'] })).payload;
}

export function requestActor(request: FastifyRequest, supplied?: string) {
  return request.micActor || supplied || 'api';
}

export function installRequestSecurity(app: FastifyInstance, config: WebSecurityConfig, verifier?: AccessVerifier) {
  app.decorateRequest('micActor', '');
  const verify = config.mode === 'remote' ? verifier ?? cloudflareAccessVerifier(config) : undefined;

  app.addHook('onRequest', async (request, reply) => {
    if (config.mode === 'local') return;
    const token = request.headers['cf-access-jwt-assertion'];
    if (typeof token !== 'string' || !token) return reply.code(401).send({ error: 'authentication_required', message: 'A valid MIC Access session is required' });
    try {
      const payload = await verify!(token);
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
      if (email !== config.email) return reply.code(403).send({ error: 'access_denied', message: 'This identity is not allowed to use MIC' });
      request.micActor = email;
    } catch {
      return reply.code(401).send({ error: 'invalid_access_session', message: 'The MIC Access session is invalid or expired' });
    }
  });

  app.addHook('preValidation', async (request, reply) => {
    if (config.mode !== 'remote' || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (typeof origin === 'string' && origin !== config.publicOrigin) return reply.code(403).send({ error: 'cross_site_request', message: 'State changes must originate from MIC' });
    if (request.headers['sec-fetch-site'] === 'cross-site') return reply.code(403).send({ error: 'cross_site_request', message: 'Cross-site state changes are not allowed' });
    if (request.body === undefined) request.body = { actor: request.micActor };
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) return;
    const body = request.body as Record<string, unknown>;
    body.actor = request.micActor;
    if ('approver' in body) body.approver = request.micActor;
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'private, no-store');
    reply.header('pragma', 'no-cache');
    return payload;
  });
}
