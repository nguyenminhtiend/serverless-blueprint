import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.test.ts', './packages/**/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './tests/coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        'infrastructure/',
        'scripts/',
        'tests/',
      ],
      thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        // Package-specific thresholds for 100% coverage
        'packages/shared-core/src/**': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'packages/shared-middleware/src/**': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        'packages/service-*/src/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@shared/core': resolve(__dirname, './packages/shared-core/src'),
      '@shared/middleware': resolve(__dirname, './packages/shared-middleware/src'),
      '@middleware': resolve(__dirname, './packages/shared-middleware/src'),
    },
  },
});
