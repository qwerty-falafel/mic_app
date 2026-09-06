import { describe, expect, it } from 'vitest';
import { isBrowserDocumentRequest } from '../../src/api.js';

describe('PWA and API content negotiation', () => {
  it('recognises browser document navigation without changing JSON API requests', () => {
    expect(isBrowserDocumentRequest({ method: 'GET', headers: { accept: 'text/html,application/xhtml+xml' } })).toBe(true);
    expect(isBrowserDocumentRequest({ method: 'GET', headers: { accept: 'application/json' } })).toBe(false);
    expect(isBrowserDocumentRequest({ method: 'GET', headers: { accept: '*/*' } })).toBe(false);
    expect(isBrowserDocumentRequest({ method: 'POST', headers: { accept: 'text/html' } })).toBe(false);
  });
});
