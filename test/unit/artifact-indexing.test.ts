import { describe, expect, it } from 'vitest';
import { selectSessionArtifactPaths } from '../../src/services/artifacts.js';

describe('session artifact ownership', () => {
  it('indexes only artifacts reported by the workflow session', () => {
    const all = [
      '_bmad-output/specs/old/SPEC.md',
      '_bmad-output/specs/new/.memlog.md',
      '_bmad-output/specs/new/SPEC.md',
    ];
    expect(selectSessionArtifactPaths(all, [
      './_bmad-output/specs/new/.memlog.md',
      '_bmad-output/specs/new/SPEC.md',
    ])).toEqual([
      '_bmad-output/specs/new/.memlog.md',
      '_bmad-output/specs/new/SPEC.md',
    ]);
    expect(selectSessionArtifactPaths(all, [])).toEqual([]);
    expect(selectSessionArtifactPaths(all, undefined)).toEqual(all);
  });
});
