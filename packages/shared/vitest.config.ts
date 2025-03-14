import { resolve } from 'path';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    globals: true,
    passWithNoTests: true,
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared-tests': resolve(__dirname, './src/__tests__'),
      '@shared-middleware': resolve(__dirname, './src/middleware'),
      '@shared-adapters': resolve(__dirname, './src/adapters'),
      '@shared-utils': resolve(__dirname, './src/utils'),
      '@shared-config': resolve(__dirname, './src/config'),
      '@shared-schema': resolve(__dirname, './src/schema'),
      '@shared-services': resolve(__dirname, './src/services'),
      '@shared-types': resolve(__dirname, './src/types'),
    },
  },
});
