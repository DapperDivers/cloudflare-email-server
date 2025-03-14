import { resolve } from 'path';

import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    outDir: 'dist-worker',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'worker.ts'),
      formats: ['es'],
      fileName: 'worker',
    },
    rollupOptions: {
      external: ['@cloudflare/pages-plugin-mailchannels'],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
    target: 'esnext',
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
  ssr: {
    target: 'webworker',
    noExternal: true,
  },
  optimizeDeps: {
    disabled: false,
  },
});
