# Vite Build Configuration

This project uses Vite to provide a modern, fast development experience and optimized production builds for both the Express server and Cloudflare Worker.

## Path Aliases

The Vite configuration includes path aliases which allow for cleaner imports throughout the codebase. These aliases are defined in both `tsconfig.json` and `vite.config.ts`:

- `@/` - Points to the `src/` directory
- `@tests/` - Points to the `src/__tests__/` directory

Example usage:
```typescript
// Instead of this:
import { logger } from '../../../utils/logger.js';

// Use this:
import { logger } from '@utils/logger.js';
```

## Multiple Build Targets

The project supports building two different targets:

1. **Express Server** (Node.js environment)
2. **Cloudflare Worker** (Edge environment)

### Express Server Build

The Express build targets a traditional Node.js environment with access to all Node.js APIs.

```bash
# Development
npm run dev

# Build
npm run build

# Start production server
npm run start
```

### Cloudflare Worker Build

The Worker build targets Cloudflare's edge environment, which has a more restricted runtime.

```bash
# Development with Vite (note: this doesn't use wrangler)
npm run dev:worker

# Development with Wrangler (recommended for Worker development)
npm run worker:dev

# Build worker only
npm run build:worker

# Deploy to Cloudflare
npm run worker:deploy
```

### Building Both Targets

You can build both targets at once with:

```bash
npm run build:all
```

## Build Configuration Details

The `vite.config.ts` file uses mode-specific configurations to customize the build for each target:

- **Express mode** (`--mode express`):
  - Outputs to `dist/` directory
  - Entry point: `src/index.ts` 
  - Uses ESM format
  - Treats Express, Nodemailer, etc. as external dependencies

- **Worker mode** (`--mode worker`):
  - Outputs to `dist/worker/` directory
  - Entry point: `src/worker.ts`
  - Uses ESM format compatible with Cloudflare Workers
  - Treats Cloudflare-specific types as external

## Development with Hot Module Replacement (HMR)

When running in development mode, the server will automatically reload when you make changes to your code. This is handled by Vite's HMR system which is integrated directly into our entry points.

Both `index.ts` and `worker.ts` include HMR-specific code that only runs in development:

```typescript
// For hot module replacement during development with Vite
if (import.meta.hot) {
  // Handling for hot module replacement
  import.meta.hot.accept(() => {
    logger.info('HMR: Code updated, restarting...');
  });
}
```

This allows for immediate feedback during development without needing to manually restart the server.

## Converting Existing Imports

When converting existing relative imports to use the path aliases, follow these guidelines:

1. Replace `../` style imports with the appropriate alias (`@/`, `@utils/`, etc.)
2. Keep the `.js` extension in the imports (required for ESM)
3. For test files, use `@tests/` instead of `../../../__tests__/`

Example:
```typescript
// Before
import { logger } from '../utils/logger.js';
import { createRateLimiter } from '../middleware/rate-limiting.js';

// After
import { logger } from '@utils/logger.js';
import { createRateLimiter } from '@middleware/index.js';
``` 