import { describe, expect, it } from 'vitest';
import { integrationVerdict, retainTrackedArtifactRefs } from '../../src/services/story-delivery.js';

describe('Story delivery safeguards', () => {
  it('removes deleted, generated, and malformed references from final Story evidence', () => {
    expect(retainTrackedArtifactRefs(
      ['src/feature.ts', 'dist/app.js', 'deleted-script.js', 42],
      ['src/feature.ts', 'README.md'],
    )).toEqual(['src/feature.ts']);
  });

  it('requires an indexed retrospective with a permitting machine verdict', () => {
    expect(integrationVerdict([])).toEqual({ found: false, verdict: undefined, permitted: false });
    expect(integrationVerdict([{ path: 'spec/RETROSPECTIVE.md', metadata: { frontmatter: { verdict: 'rejected' } } }])).toEqual({ found: true, verdict: 'rejected', permitted: false });
    expect(integrationVerdict([{ path: 'spec/RETROSPECTIVE.md', metadata: { frontmatter: { verdict: 'accepted-with-open-items' } } }])).toEqual({ found: true, verdict: 'accepted-with-open-items', permitted: true });
    expect(integrationVerdict([
      { path: 'other/RETROSPECTIVE.md', metadata: { frontmatter: { verdict: 'accepted' } } },
      { path: 'current/RETROSPECTIVE.md', metadata: { frontmatter: { verdict: 'rejected' } } },
    ], 'current/RETROSPECTIVE.md')).toEqual({ found: true, verdict: 'rejected', permitted: false });
  });
});
