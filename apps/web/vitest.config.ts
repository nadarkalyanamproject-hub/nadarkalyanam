import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/**/*.spec.ts', 'components/**/*.spec.tsx'],
    environment: 'node',
  },
});
