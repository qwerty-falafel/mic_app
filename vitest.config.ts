import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['test/**/*.test.ts'],
  coverage: { provider: 'v8', include: ['scripts/phase0/**/*.ts', 'src/**/*.ts'], reporter: ['text', 'json-summary', 'html'] },
} });
