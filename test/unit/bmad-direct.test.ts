import { describe, expect, it } from 'vitest';
import { deriveBmadStatus, orderArtifactRefs } from '../../src/adapters/bmad-direct.js';

describe('BMAD contract mapping', () => {
  it('requires a durable terminal contract rather than trusting exit zero', () => {
    expect(deriveBmadStatus('implementation', [], [], 0)).toBe('failed');
    expect(deriveBmadStatus('planning', ['spec/SPEC.md'], ['# Spec'], 0)).toBe('done');
    expect(deriveBmadStatus('implementation', ['story.md'], ['---\nstatus: done\n---'], 0)).toBe('done');
    expect(deriveBmadStatus('implementation', ['story.md'], ['---\nstatus: blocked\n---\nblocked: no subagents'], 0)).toBe('blocked');
  });

  it('makes SPEC.md the canonical planning artifact', () => {
    expect(orderArtifactRefs('planning', ['spec/.memlog.md', 'spec/notes.md', 'spec/SPEC.md'])).toEqual([
      'spec/SPEC.md',
      'spec/notes.md',
      'spec/.memlog.md',
    ]);
  });
});
