# Adapter Pattern Implementation

This document explains how the adapter pattern is implemented in this project to support multiple environments (Express and Cloudflare Workers) with shared core logic.

## Architecture Overview

The adapter pattern allows us to run the same core application logic in different environments by providing environment-specific adapters. This ensures that environment-specific code is isolated from the core business logic.

```
┌────────────────────┐          ┌────────────────────┐
│                    │          │                    │
│  Express Server    │          │ Cloudflare Worker  │
│                    │          │                    │
└─────────┬──────────┘          └──────────┬─────────┘
          │                                │
          ▼                                ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│               Request/Response Adapters             │
│                                                     │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│          Environment-Agnostic Middleware            │
│                                                     │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│             Core Application Logic                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Key Components

### 1. Common Interfaces

These define the contract that all environment-specific implementations must follow:

- `CommonRequest` - Interface for HTTP requests
- `CommonResponse` - Interface for HTTP responses
- `CommonMiddleware` - Interface for middleware functions

### 2. Environment-Specific Adapters

These adapt the native environment objects to our common interfaces:

- `ExpressRequestAdapter` - Adapts Express Request
- `ExpressResponseAdapter` - Adapts Express Response
- `WorkerRequestAdapter` - Adapts Worker Request
- `WorkerResponseAdapter` - Adapts Worker Response

### 3. Middleware Adapters

These adapt middleware from one environment to another:

- `adaptExpressMiddleware` - Adapts Express middleware to work with our common interfaces
- `runMiddlewareChain` - Runs a chain of environment-agnostic middleware

### 4. Environment-Agnostic Middleware

These middleware components work with our common interfaces and can run in any environment:

- `securityHeadersMiddleware` - Sets security headers
- `commonEmailRateLimiter` - Rate limiting by email address
- `commonCorsHandler` - CORS handling
- `commonValidateEmailRequest` - Input validation
- `commonErrorHandler` - Error handling

## Usage Examples

### Express Environment

```typescript
import express from 'express';
import { ExpressRequestAdapter, ExpressResponseAdapter } from '@/adapters/request-response.js';
import { securityMiddleware } from '@/middleware/index.js';

const app = express();

// Using Express-specific middleware directly
app.use(securityMiddleware);

// Using environment-agnostic middleware with Express
app.use((req, res, next) => {
  const adaptedReq = new ExpressRequestAdapter(req);
  const adaptedRes = new ExpressResponseAdapter(res);
  commonCorsHandler(adaptedReq, adaptedRes, next);
});
```

### Cloudflare Worker Environment

```typescript
import { WorkerRequestAdapter, WorkerResponseAdapter } from '@/adapters/request-response.js';
import { runMiddlewareChain } from '@/adapters/middleware-adapter.js';
import { securityHeadersMiddleware, commonCorsHandler } from '@/middleware/index.js';

export default {
  async fetch(request) {
    const req = new WorkerRequestAdapter(request);
    const res = new WorkerResponseAdapter();
    
    // Run environment-agnostic middleware
    const middlewares = [
      securityHeadersMiddleware,
      commonCorsHandler
    ];
    
    await runMiddlewareChain(req, res, middlewares);
    
    return res.send();
  }
};
```

## Best Practices

1. **Always create environment-agnostic versions** of middleware that need to run in both environments.

2. **Use the common interfaces** (`CommonRequest`, `CommonResponse`) when developing core logic.

3. **Keep environment-specific code isolated** in adapters or entry points.

4. **Prefer composition over inheritance** when creating adapters.

5. **Use explicit typing** to ensure type safety across the adapter boundary.

6. **Test middleware in both environments** to ensure consistent behavior.

## Middleware Implementation Guidelines

When creating new middleware:

1. Create an Express-specific version if needed (e.g., for third-party Express middleware).
2. Create an environment-agnostic version using `CommonRequest` and `CommonResponse`.
3. Export both versions from the middleware module.
4. Add both versions to the central index.ts exports.

Example:

```typescript
// Express-specific version
export const myMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Implementation
};

// Environment-agnostic version
export const commonMyMiddleware = (req: CommonRequest, res: CommonResponse, next: () => void) => {
  // Implementation
};
``` 