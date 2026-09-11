import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import { loadConfig, type WebSecurityConfig } from '../../src/config.js';
import { installRequestSecurity } from '../../src/security.js';

const remote: WebSecurityConfig = {
  mode: 'remote',
  publicOrigin: 'https://mic.aidevtools.co.uk',
  teamDomain: 'https://aidevtools.cloudflareaccess.com',
  audience: 'mic-audience',
  email: 'michael@example.com',
  allowedOrigins: ['https://mic.aidevtools.co.uk'],
};

async function secured(verifier = vi.fn(async () => ({ email: 'michael@example.com' }))) {
  const app = Fastify();
  installRequestSecurity(app, remote, verifier);
  app.get('/whoami', async request => ({ actor: request.micActor }));
  app.post('/decision', async request => request.body);
  await app.ready();
  return { app, verifier };
}

describe('MIC web security', () => {
  test('local configuration remains usable without remote credentials', () => {
    const config = loadConfig({ PORT: '3100' });
    expect(config.webSecurity).toEqual({ mode: 'local', allowedOrigins: ['http://127.0.0.1:3100', 'http://localhost:3100'] });
  });

  test('remote configuration fails closed when incomplete', () => {
    expect(() => loadConfig({ MIC_DEPLOYMENT_MODE: 'remote' })).toThrow('MIC_PUBLIC_ORIGIN');
  });

  test('loads a complete HTTPS Cloudflare Access contract', () => {
    const config = loadConfig({
      MIC_DEPLOYMENT_MODE: 'remote',
      MIC_PUBLIC_ORIGIN: 'https://mic.aidevtools.co.uk',
      MIC_ACCESS_TEAM_DOMAIN: 'https://aidevtools.cloudflareaccess.com',
      MIC_ACCESS_AUDIENCE: 'audience',
      MIC_ACCESS_EMAIL: 'Michael@Example.com',
    });
    expect(config.webSecurity).toMatchObject({ mode: 'remote', email: 'michael@example.com', allowedOrigins: ['https://mic.aidevtools.co.uk'] });
  });

  test('denies a request without an Access assertion', async () => {
    const { app } = await secured();
    const response = await app.inject({ method: 'GET', url: '/whoami' });
    expect(response.statusCode).toBe(401);
    expect(response.headers['cache-control']).toBe('private, no-store');
    await app.close();
  });

  test('denies a verified but unapproved identity', async () => {
    const { app } = await secured(vi.fn(async () => ({ email: 'someone@example.com' })));
    const response = await app.inject({ method: 'GET', url: '/whoami', headers: { 'cf-access-jwt-assertion': 'signed' } });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  test('uses the verified identity and replaces a caller-supplied actor', async () => {
    const { app, verifier } = await secured();
    const response = await app.inject({
      method: 'POST',
      url: '/decision',
      headers: { 'cf-access-jwt-assertion': 'signed', origin: remote.publicOrigin, 'content-type': 'application/json' },
      payload: { actor: 'forged', approver: 'forged', decision: 'accepted' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ actor: remote.email, approver: remote.email, decision: 'accepted' });
    expect(verifier).toHaveBeenCalledWith('signed');
    await app.close();
  });

  test('rejects a cross-site mutation from an authenticated browser', async () => {
    const { app } = await secured();
    const response = await app.inject({ method: 'POST', url: '/decision', headers: { 'cf-access-jwt-assertion': 'signed', origin: 'https://attacker.example', 'content-type': 'application/json' }, payload: {} });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('cross_site_request');
    await app.close();
  });
});
