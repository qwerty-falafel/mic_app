import { describe, expect, it } from 'vitest';
import { llamaCppModelId } from '../../src/services/product-proposals.js';

describe('product proposal model routing', () => {
  it('uses the router model id rather than the OpenCode provider-qualified name', () => {
    expect(llamaCppModelId('llama.cpp/gpt-oss-120b-F16')).toBe('gpt-oss-120b-F16');
    expect(llamaCppModelId('gpt-oss-120b-F16')).toBe('gpt-oss-120b-F16');
  });
});
