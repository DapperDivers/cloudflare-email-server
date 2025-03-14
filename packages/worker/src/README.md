# Worker Package

This package contains all Cloudflare Worker-specific implementations and adapters for the Cloudflare Email Server. It provides a clean separation between the Worker-specific code and the shared business logic.

## Directory Structure

```
src/
├── adapters/         # Worker-specific adapters
│   ├── request-response.ts # Request/Response adapters for Cloudflare Workers
│   └── index.ts      # Exports for adapters
├── middleware/       # Worker-specific middleware
├── utils/            # Worker-specific utilities
└── worker.ts         # Main entry point for the Cloudflare Worker
```

## Key Components

### Adapters

- **WorkerRequestAdapter**: Adapts Cloudflare Worker Request to CommonRequest
- **WorkerResponseAdapter**: Adapts Cloudflare Worker Response to CommonResponse

### Middleware and Utilities

Similar to the Express server package, this package can contain Worker-specific middleware and utilities as needed.

## Integration with Shared Package

The Worker package depends on common interfaces and utilities from the shared package:

- `CommonRequest` and `CommonResponse` interfaces
- Error handling utilities like `handleError` and `createErrorResponse`
- `runMiddlewareChain` utility function
- Common schemas and types

## Migration Notes

The following Worker-specific code was moved from the shared package to this package:

1. **Request/Response Adapters**:
   - `WorkerRequestAdapter` and `WorkerResponseAdapter` classes now reside here
   - The shared package retains only the interfaces

This separation aligns with our architecture where:
1. Common business logic and interfaces live in the shared package
2. Express-specific implementations live in the express-server package
3. Worker-specific implementations live in this worker package 