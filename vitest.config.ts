import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['db/**/*.test.ts', 'shared/**/*.test.ts', 'worker/**/*.test.ts'],
    exclude: ['node_modules/**', 'web/**'],
    // Tests d'intégration sur la même base Postgres — éviter les courses
    // de migration parallèles entre fichiers.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['shared/**/*.ts'],
      exclude: ['**/*.test.ts', 'shared/types.ts'],
    },
  },
});
