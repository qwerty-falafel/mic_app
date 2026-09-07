import { describe, expect, it } from 'vitest';
import { analyseStoryInventory } from '../../src/services/story-outcomes.js';

const spec = '# Capabilities\n## CAP-1 Immediate playback\n## CAP-2 Continuous reading\n';
describe('value-shaped BMAD Story inventory', () => {
  it('extracts outcomes and checkpoint choices', () => {
    const result = analyseStoryInventory(`- id: "1"\n  title: Hear the first passage quickly\n  description: As a long-form listener, I want to hear the opening passage while later audio is prepared, so that I can start listening without waiting for the whole document. Covers CAP-1 and CAP-2.\n  spec_checkpoint: true\n  done_checkpoint: true\n`, spec);
    expect(result.issues).toEqual([]);
    expect(result.stories[0]).toMatchObject({ beneficiary: 'long-form listener', capabilityIds: ['CAP-1', 'CAP-2'], specCheckpoint: true, doneCheckpoint: true });
  });
  it('rejects task fragments, invalid schema, and unknown capabilities', () => {
    const result = analyseStoryInventory(`- id: 1\n  title: Implement chunker\n  description: Split at paragraph boundaries.\n  status: backlog\n- id: "2"\n  title: Play audio\n  description: As a user, I want to hear audio, so that audio plays. Covers CAP-99.\n`, spec);
    expect(result.issues).toEqual(expect.arrayContaining([expect.stringContaining('quoted string'), expect.stringContaining('beneficiary'), expect.stringContaining('must not contain status'), expect.stringContaining('unknown capability CAP-99')]));
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('generic')]));
  });
  it('enforces top-level list and prefix-free ids', () => {
    expect(analyseStoryInventory('stories: []', spec).issues).toContain('stories.yaml must be a top-level list');
    const description = 'As a reader, I want to hear a document, so that I can absorb it. Covers CAP-1.';
    expect(analyseStoryInventory(`- id: "3"\n  title: Read\n  description: ${description}\n- id: "3-2"\n  title: Continue\n  description: ${description}\n`, spec).issues).toContain('Story ids must be prefix-free: 3');
  });
  it('requires the accepted specification to be fully accounted for', () => {
    const result = analyseStoryInventory('- id: "1"\n  title: Start listening\n  description: As a listener, I want to hear audio promptly, so that I can begin without waiting. Covers CAP-1.\n', spec);
    expect(result.issues).toContain('stories.yaml does not account for governing capabilities: CAP-2');
  });
});
