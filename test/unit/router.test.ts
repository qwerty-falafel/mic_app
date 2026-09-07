import { describe, expect, it } from 'vitest';
import { deliveryPath, parseRoute, productPath } from '../../frontend/src/router.js';

const at = (pathname: string, search = '') => parseRoute({ pathname, search } as Location);

describe('route-backed MIC places', () => {
  it('recognises every durable workspace route', () => {
    expect(at('/')).toEqual({ name: 'home' });
    expect(at('/products')).toEqual({ name: 'products' });
    expect(at('/products/tts')).toEqual({ name: 'product', productSlug: 'tts', section: 'overview' });
    expect(at('/products/tts/backlog')).toEqual({ name: 'product', productSlug: 'tts', section: 'backlog' });
    expect(at('/products/tts/roadmap')).toEqual({ name: 'product', productSlug: 'tts', section: 'roadmap', reference: undefined });
    expect(at('/products/tts/board/PBI-12')).toEqual({ name: 'product', productSlug: 'tts', section: 'board', reference: 'PBI-12' });
    expect(at('/products/tts/sprints')).toEqual({ name: 'product', productSlug: 'tts', section: 'sprints', reference: undefined });
    expect(at('/products/tts/settings')).toEqual({ name: 'product', productSlug: 'tts', section: 'settings', reference: undefined });
    expect(at('/products/tts/delivery/long-text')).toMatchObject({ name: 'delivery', view: 'current' });
    expect(at('/products/tts/delivery/long-text/stage/specification')).toMatchObject({ name: 'delivery', view: 'stage', reference: 'specification' });
    expect(at('/products/tts/delivery/long-text/runs/run-1', '?tab=logs')).toMatchObject({ name: 'delivery', view: 'run', reference: 'run-1', tab: 'logs' });
    expect(at('/products/tts/delivery/long-text/artifacts/artifact-1')).toMatchObject({ name: 'delivery', view: 'artifact', reference: 'artifact-1' });
    expect(at('/products/tts/delivery/long-text/advanced')).toMatchObject({ name: 'delivery', view: 'advanced' });
  });

  it('builds encoded human-readable product and delivery paths', () => {
    expect(productPath('TTS product')).toBe('/products/TTS%20product');
    expect(deliveryPath('TTS product', 'long/text')).toBe('/products/TTS%20product/delivery/long%2Ftext');
  });

  it('fails closed for malformed or incomplete locations', () => {
    expect(at('/projects')).toEqual({ name: 'not-found' });
    expect(at('/products/tts/delivery')).toEqual({ name: 'not-found' });
    expect(at('/settings/more')).toEqual({ name: 'not-found' });
  });
});
