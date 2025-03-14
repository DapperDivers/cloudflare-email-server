# Express Server Package

This package contains all Express-specific implementations and adapters for the Cloudflare Email Server. It provides a clean separation between the Express-specific code and the shared business logic.

## Directory Structure

```
src/
├── adapters/         # Express-specific adapters
│   ├── request-response.ts # Request/Response adapters for Express
│   ├── middleware-adapter.ts # Middleware adapter for Express
│   └── index.ts      # Exports for adapters
├── middleware/       # Express-specific middleware
│   ├── rate-limiting.ts # Rate limiting middleware
│   ├── security.ts   # Security and CORS middleware
│   ├── validation.ts # Validation middleware
│   └── index.ts      # Exports for middleware
├── utils/            # Express-specific utilities
│   ├── error-handler.ts # Error handling utilities
│   └── index.ts      # Exports for utilities
└── index.ts          # Main entry point
```

## Key Components

### Adapters

- **ExpressRequestAdapter**: Adapts Express Request to CommonRequest
- **ExpressResponseAdapter**: Adapts Express Response to CommonResponse
- **adaptExpressMiddleware**: Adapts Express middleware to work with common interfaces

### Middleware

- **Rate Limiting**:
  - `createRateLimiter`: Creates Express-specific rate limiter
  - `emailRateLimiter`: Email-specific rate limiter

- **Security**:
  - `createSecurityMiddleware`: Creates coordinated CORS and security middleware
  - `isOriginAllowed`: Utility to check if an origin is allowed by CORS

- **Validation**:
  - `validateBody`: Validates request body against a Zod schema
  - `validateEmailRequest`: Express-specific email request validation
  - `commonValidateEmailRequest`: Common email validation for both environments

### Utilities

- **Error Handling**:
  - `expressErrorHandler`: Express-specific error handler middleware
  - `asyncExpressHandler`: Wrapper for async Express route handlers

## Integration with Shared Package

The Express server package depends on common interfaces and utilities from the shared package:

- `CommonRequest` and `CommonResponse` interfaces
- Error handling utilities like `handleError` and `createErrorResponse`
- `runMiddlewareChain` utility function
- Common schemas and types

## Migration Notes

The following Express-specific code was moved from the shared package to this package:

1. **Request/Response Adapters**:
   - `ExpressRequestAdapter` and `ExpressResponseAdapter` classes now reside here
   - The shared package retains only the interfaces and Worker implementations

2. **Middleware Adapter**:
   - `adaptExpressMiddleware` function was moved here
   - The shared package keeps only the environment-agnostic `runMiddlewareChain`

3. **Express-Specific Middleware**:
   - Rate limiting, security, and validation middleware moved here
   - Shared package contains only environment-agnostic middleware functions

This separation allows for a clean architecture where:
1. Common business logic and interfaces live in the shared package
2. Express-specific implementations live in this package
3. Worker-specific implementations live in the worker package 