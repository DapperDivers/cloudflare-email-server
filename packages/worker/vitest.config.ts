import { resolve } from 'path';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist-worker'],
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
      '@tests': resolve(__dirname, './src/__tests__'),
      '@middleware': resolve(__dirname, './src/middleware'),
      '@core': resolve(__dirname, './src/core'),
      '@adapters': resolve(__dirname, './src/adapters'),
      '@utils': resolve(__dirname, './src/utils'),
      '@schema': resolve(__dirname, './src/schema'),
      '@services': resolve(__dirname, './src/services'),
      '@types': resolve(__dirname, './src/types'),
      shared: resolve(__dirname, '../shared/src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    global: 'globalThis',
    process: {},
  },
});
