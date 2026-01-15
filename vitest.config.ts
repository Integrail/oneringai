import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'examples/**',
        'dist/**',
        '**/*.d.ts',
        'tests/**',
        '**/index.ts', // Export files
        'src/agents/ProviderConfigAgent.ts', // AI agent (hard to test)
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      // Per-file thresholds for critical code
      perFile: true,
    },
    testTimeout: 30000, // 30s for integration tests
    hookTimeout: 10000,
    threads: true, // Parallel execution
    isolate: true, // Isolated context per test file
    pool: 'threads',
    // Retry flaky tests
    retry: 0, // No retries - tests should be deterministic
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
