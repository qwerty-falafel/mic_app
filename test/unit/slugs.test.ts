import { describe, expect, it } from 'vitest';
import { durableSlug, slugify } from '../../src/services/slugs.js';

describe('durable product slugs', () => {
  it('normalizes labels and keeps identities collision-safe', () => {
    expect(slugify('  Long-form TTS: Playback!  ')).toBe('long-form-tts-playback');
    expect(durableSlug('Same name', 'first')).not.toBe(durableSlug('Same name', 'second'));
    expect(durableSlug('Same name', 'first')).toMatch(/^same-name-[a-f0-9]{6}$/);
  });
});
