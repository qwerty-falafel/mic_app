import { describe, expect, it } from 'vitest';
import { evaluateGates } from '../../src/gates/validator.js';
import { selectModel } from '../../src/model-policy.js';
import { canAcceptRun } from '../../src/services/resource-monitor.js';
describe('minimal gates and admission', () => {
  it('requires build and test evidence from the exact revision', () => {
    expect(evaluateGates('abc', [{ kind: 'BUILD_PASS', revision: 'abc', passed: true, data: {} }, { kind: 'TESTS_PASS', revision: 'abc', passed: true, data: {} }]).passed).toBe(true);
    expect(evaluateGates('def', [{ kind: 'BUILD_PASS', revision: 'abc', passed: true, data: {} }]).passed).toBe(false);
  });
  it('selects explicitly and rejects unsafe admission', () => {
    const model = selectModel('coding', 'standard');
    expect(() => selectModel('vision', 'senior')).toThrow('No model configured');
    expect(canAcceptRun({ availableMiB: 50000, totalMiB: 120000, swapInUseMiB: 0, modelBusy: false, modelId: model }, model)).toBe(true);
    expect(canAcceptRun({ availableMiB: 100, totalMiB: 120000, swapInUseMiB: 0, modelBusy: false }, model)).toBe(false);
  });
});
