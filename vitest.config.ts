import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'worker/**/*.test.ts'],
    exclude: ['node_modules/**', 'web/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['shared/**/*.ts'],
      exclude: ['**/*.test.ts', 'shared/types.ts'],
    },
  },
});
