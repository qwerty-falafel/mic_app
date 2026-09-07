import { describe, expect, it } from 'vitest';
import { WorkstreamService } from '../../src/services/workstreams.js';

describe('BMAD operation capabilities', () => {
  const service = new WorkstreamService({} as any);
  const catalog = [{ skill: 'bmad-spec', action: null }, { skill: 'bmad-help', action: null }];

  it('allows the installed bmad-spec command to run its declared Story Breakdown operation', () => {
    expect(service.operationIsEligible(catalog, 'bmad-spec', 'create-stories')).toBe(true);
  });

  it('does not turn an actionless catalog entry into arbitrary operations', () => {
    expect(service.operationIsEligible(catalog, 'bmad-spec', 'invent-stories')).toBe(false);
    expect(service.operationIsEligible(catalog, 'bmad-help', 'create-stories')).toBe(false);
  });
});
