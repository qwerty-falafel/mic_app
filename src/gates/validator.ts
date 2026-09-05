export type Evidence = { kind: 'BUILD_PASS' | 'TESTS_PASS'; revision: string; passed: boolean; data: unknown };
export function evaluateGates(revision: string, evidence: Evidence[], required: Evidence['kind'][] = ['BUILD_PASS', 'TESTS_PASS']) {
  const results = required.map(kind => ({ kind, passed: evidence.some(item => item.kind === kind && item.revision === revision && item.passed) }));
  return { passed: results.every(result => result.passed), revision, results };
}
