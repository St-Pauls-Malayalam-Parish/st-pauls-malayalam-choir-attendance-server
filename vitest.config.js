import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/index.js', 'src/seed.js', 'src/models/**'],
      reporter: ['text', 'text-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 95,
        functions: 94,
        branches: 85,
        statements: 93,
      },
    },
  },
});
