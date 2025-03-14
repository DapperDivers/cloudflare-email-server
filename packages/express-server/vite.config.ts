import { resolve } from 'path';

import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  console.log(`Building with mode: ${mode}`);

  return {
    plugins: [tsconfigPaths()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'node18',
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['es'],
        fileName: 'index',
      },
      rollupOptions: {
        external: [
          'express',
          'cors',
          'dotenv',
          'express-mongo-sanitize',
          'express-rate-limit',
          'express-validator',
          'helmet',
          'hpp',
          'nodemailer',
        ],
        output: {
          banner: '#!/usr/bin/env node',
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@tests': resolve(__dirname, './src/__tests__'),
        '@middleware': resolve(__dirname, './src/middleware'),
        '@core': resolve(__dirname, './src/core'),
        '@adapters': resolve(__dirname, './src/adapters'),
        '@utils': resolve(__dirname, './src/utils'),
        '@config': resolve(__dirname, './src/config'),
        '@schema': resolve(__dirname, './src/schema'),
        '@services': resolve(__dirname, './src/services'),
        '@types': resolve(__dirname, './src/types'),
        shared: resolve(__dirname, '../shared/src'),
      },
    },
  };
});
