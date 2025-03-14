import fs from 'fs';

import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

const isProduction = process.env.NODE_ENV === 'production';

async function runBuild() {
  try {
    // Ensure the dist directory exists
    if (!fs.existsSync('./dist')) {
      fs.mkdirSync('./dist', { recursive: true });
    }

    // Define Node.js built-ins to exclude
    const nodeBuiltins = [
      'crypto',
      'http',
      'https',
      'net',
      'path',
      'stream',
      'tls',
      'util',
      'buffer',
      'os',
      'fs',
      'child_process',
      'zlib',
      'events',
      'querystring',
      'url',
      'assert',
      'constants',
      'domain',
      'string_decoder',
      'dgram',
      'dns',
      'punycode',
      'process',
      'readline',
      'repl',
      'vm',
      'http2',
      // Node prefix versions
      'node:events',
      'node:process',
      'node:util',
      'node:http2',
      'node:stream',
      'node:buffer',
      'node:path',
      'node:fs',
      'node:crypto',
      'node:http',
      'node:https',
    ];

    // Problematic packages that should be excluded
    const problematicPackages = [
      'googleapis',
      'googleapis-common',
      'google-auth-library',
      'google-logging-utils',
      'json-bigint',
      'nodemailer',
    ];

    // Mock content for specific modules
    const mockContent = {
      googleapis: `
        export class GoogleApis {
          gmail() { return { users: { messages: { send: async () => ({}) } } }; }
        }
        export const google = new GoogleApis();
      `,
      nodemailer: `
        export default {
          createTransport: () => ({
            sendMail: async () => ({ messageId: 'mock-id' })
          })
        };
      `,
    };

    // Run the build
    const result = await build({
      entryPoints: ['./src/worker.ts'],
      bundle: true,
      minify: isProduction,
      sourcemap: !isProduction,
      format: 'esm',
      outfile: './dist/worker.js',
      target: 'es2020',
      platform: 'browser',
      metafile: true, // Generate metadata for bundle analysis
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        global: 'globalThis',
      },
      plugins: [
        // Prevent bundling node_modules except for 'shared'
        nodeExternalsPlugin({
          allowList: ['shared'],
          // Explicitly exclude problematic packages
          exclude: problematicPackages,
        }),
        // Handle Node.js built-ins and problematic packages
        {
          name: 'modules-polyfill',
          setup(build) {
            // Handle Node.js built-ins
            nodeBuiltins.forEach((mod) => {
              build.onResolve({ filter: new RegExp(`^${mod}$`) }, (args) => {
                return { path: args.path, namespace: 'empty-module' };
              });

              // Handle subpaths (e.g., crypto/subtle)
              build.onResolve({ filter: new RegExp(`^${mod}/.*`) }, (args) => {
                return { path: args.path, namespace: 'empty-module' };
              });
            });

            // Handle problematic packages
            problematicPackages.forEach((pkg) => {
              build.onResolve({ filter: new RegExp(`^${pkg}($|/.*)`) }, (args) => {
                return { path: pkg, namespace: 'mock-module' };
              });
            });

            // Provide empty modules for Node.js built-ins
            build.onLoad({ filter: /.*/, namespace: 'empty-module' }, () => {
              return {
                contents: `
                  export default {};
                  export function createHash() { return {}; }
                  export function randomBytes() { return {}; }
                  export function createRequire() { return () => ({}); }
                  export const EventEmitter = class EventEmitter {
                    on() { return this; }
                    once() { return this; }
                    emit() { return true; }
                  };
                `,
              };
            });

            // Provide mock implementations for problematic packages
            build.onLoad({ filter: /.*/, namespace: 'mock-module' }, (args) => {
              // If we have a specific mock for this package, use it
              if (mockContent[args.path]) {
                return { contents: mockContent[args.path] };
              }

              // Default mock for any other problematic package
              return {
                contents: `
                  export default {};
                  export class GoogleApis {}
                  export class JWT {}
                  export class OAuth2Client {}
                  export const google = {};
                `,
              };
            });
          },
        },
      ],
      // Main fields to prefer browser versions
      mainFields: ['browser', 'module', 'main'],
      // Tree shaking options
      treeShaking: true,
      // Suppress warnings about missing exports from Node.js modules
      logOverride: {
        'direct-eval': 'silent',
        'unsupported-javascript-syntax': 'silent',
        'undefined-global': 'silent',
        'different-path-case': 'silent',
        'ignored-bare-import': 'silent',
        'missing-loader': 'silent',
      },
    });

    // Write metadata for analysis if in production mode
    if (isProduction && result.metafile) {
      fs.writeFileSync('./dist/meta.json', JSON.stringify(result.metafile));
    }

    const outputSize = fs.statSync('./dist/worker.js').size;
    console.log(`Build completed successfully: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);

    if (isProduction) {
      console.log(`Compressed size estimate: ${(outputSize / 1024 / 3).toFixed(2)} KB (gzipped)`);
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

runBuild();
