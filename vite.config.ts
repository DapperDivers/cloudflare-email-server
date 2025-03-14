import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

// Common external dependencies - don't bundle these
const commonExternals = [
  'express',
  'nodemailer',
  'cors',
  'dotenv',
  'express-rate-limit',
  'zod',
];

// Define build configurations for different targets
export default defineConfig(({ mode }) => {
  // Base configuration shared between all builds
  const baseConfig = {
    plugins: [
      // Use tsconfig paths in Vite
      tsconfigPaths(),
    ],
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
      },
    },
    server: {
      port: 3001,
    },
  };

  // Express server build (Node.js environment)
  if (mode === 'express' || !mode) {
    return {
      ...baseConfig,
      build: {
        outDir: 'dist',
        minify: process.env.NODE_ENV === 'production',
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          formats: ['es'],
          fileName: () => 'index.js',
        },
        rollupOptions: {
          external: commonExternals,
        },
      },
    };
  }

  // Cloudflare worker build
  if (mode === 'worker') {
    return {
      ...baseConfig,
      build: {
        outDir: 'dist/worker',
        minify: process.env.NODE_ENV === 'production',
        lib: {
          entry: resolve(__dirname, 'src/worker.ts'),
          formats: ['es'],
          fileName: () => 'worker.js',
        },
        rollupOptions: {
          external: [
            // Workers have different externals - Cloudflare provides these
            '@cloudflare/workers-types',
          ],
        },
      },
      // Worker-specific optimizations
      optimizeDeps: {
        // Exclude specific dependencies for workers
        exclude: ['@cloudflare/workers-types'],
      },
    };
  }

  return baseConfig;
}); 