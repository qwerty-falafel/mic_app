import { describe, expect, it } from 'vitest';
import { awaitsInput, conversationFromJsonl, nodeVerificationScripts, preserveControlState, storyStatusFromSession } from '../../src/services/workflow-sessions.js';

describe('durable workflow conversation contracts', () => {
  it('selects available Node verification commands and rejects malformed package data', () => {
    expect(nodeVerificationScripts('{"scripts":{"test":"vitest run","build":"vite build","dev":"vite"}}')).toEqual([['run', 'test'], ['run', 'build']]);
    expect(nodeVerificationScripts('{"scripts":{"dev":"vite"}}')).toEqual([]);
    expect(() => nodeVerificationScripts('{broken')).toThrow();
  });

  it('extracts the provider session and assistant output from OpenCode JSONL', () => {
    const source = [
      JSON.stringify({ type: 'step_start', sessionID: 'ses_123', part: {} }),
      JSON.stringify({ type: 'text', sessionID: 'ses_123', part: { text: 'Choose a planning route?' } }),
    ].join('\n');
    expect(conversationFromJsonl(source)).toEqual({ providerSessionId: 'ses_123', content: 'Choose a planning route?' });
  });

  it('distinguishes a conversational checkpoint from completed output', () => {
    expect(awaitsInput('bmad-prd', 'Which audience should this serve?', [])).toBe(true);
    expect(awaitsInput('bmad-prd', 'Draft saved. Continue to the next section?', ['draft-prd.md'])).toBe(true);
    expect(awaitsInput('bmad-prd', 'Created the PRD.', ['_bmad-output/planning-artifacts/prd.md'])).toBe(false);
    expect(awaitsInput('bmad-project-context', 'Applied this configuration:\n```js\nconst value = configured ?? fallback;\n```\nChanges are complete.', [])).toBe(false);
    expect(awaitsInput('bmad-prd', 'Draft saved.\nPlease choose one audience.', ['draft-prd.md'])).toBe(true);
    expect(awaitsInput('bmad-spec', '### Required human judgments\n\nPlease respond with a YAML-style list matching the schema.', [])).toBe(true);
    expect(awaitsInput('bmad-spec', 'Both slices pass the release test. Let me know if this slicing meets your expectations.', [])).toBe(true);
    expect(awaitsInput('bmad-help', 'Would you like guidance?', [])).toBe(false);
  });

  it('does not let the SIGTERM observation overwrite an intentional pause', () => {
    expect(preserveControlState('PAUSED', 'CANCELLED')).toBe('PAUSED');
    expect(preserveControlState('CANCELLED', 'FAILED')).toBe('CANCELLED');
    expect(preserveControlState('INTERRUPTED', 'CANCELLED')).toBe('INTERRUPTED');
    expect(preserveControlState('RUNNING', 'FINISHED')).toBe('FINISHED');
  });

  it('holds finished work for human outcome acceptance when requested', () => {
    expect(storyStatusFromSession('FINISHED', true)).toBe('review');
    expect(storyStatusFromSession('FINISHED', false)).toBe('done');
    expect(storyStatusFromSession('WAITING_FOR_INPUT', true)).toBe('in-progress');
  });
});
