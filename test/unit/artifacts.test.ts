import { describe, expect, it } from 'vitest';
import { parseArtifact } from '../../src/services/artifacts.js';

describe('BMAD artifact intelligence', () => {
  it('recognizes native artifacts and extracts review cues', () => {
    const parsed = parseArtifact('_bmad-output/specs/reader/SPEC.md', `---\nstatus: ready-for-dev\nsources:\n  - brief.md\n---\n# Reader\n- Assumption: the service limit is 5000\n- Open question: what prefetch depth?\n- Conflict: old UI caps input\n`);
    expect(parsed).toMatchObject({ type: 'spec', status: 'ready-for-dev', assumptions: ['the service limit is 5000'], questions: ['what prefetch depth?'], conflicts: ['old UI caps input'] });
  });

  it('recognizes memlogs and native story inventories', () => {
    expect(parseArtifact('spec/.memlog.md', '# Decisions').type).toBe('memlog');
    expect(parseArtifact('spec/stories.yaml', '- id: "1"\n  title: First').type).toBe('story-inventory');
    expect(parseArtifact('_bmad-output/implementation-artifacts/sprint-status.yaml', 'status: active').type).toBe('sprint-status');
  });
});
