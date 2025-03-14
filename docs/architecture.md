# Email Service Architecture

This document explains the architecture of the Cloudflare Email Server, which is designed to run in both a traditional Node.js environment and a Cloudflare Workers environment.

## Architecture Overview

The architecture follows these design principles:

1. **Separation of Concerns**: Core business logic is separated from environment-specific implementation details
2. **Adapter Pattern**: Environment-specific adapters convert between different APIs
3. **DRY (Don't Repeat Yourself)**: Shared utilities and core functionality prevent code duplication
4. **Environment Neutrality**: Core logic works identically regardless of the runtime environment

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Entry Points                                │
│                                                                      │
│  ┌───────────────────┐                   ┌────────────────────────┐  │
│  │                   │                   │                        │  │
│  │     index.ts      │                   │       worker.ts        │  │
│  │   (Express App)   │                   │  (Cloudflare Worker)   │  │
│  │                   │                   │                        │  │
│  └─────────┬─────────┘                   └───────────┬────────────┘  │
└────────────┼──────────────────────────────────────────┼──────────────┘
             │                                          │
             ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Adapters                                    │
│                                                                      │
│  ┌───────────────────┐                   ┌────────────────────────┐  │
│  │                   │                   │                        │  │
│  │  ExpressRequest/  │                   │  WorkerRequest/       │  │
│  │  Response Adapter │                   │  Response Adapter      │  │
│  │                   │                   │                        │  │
│  └─────────┬─────────┘                   └───────────┬────────────┘  │
└────────────┼──────────────────────────────────────────┼──────────────┘
             │                                          │
             ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Environment-Agnostic Core                       │
│                                                                      │
│  ┌───────────────────┐    ┌────────────────┐    ┌────────────────┐  │
│  │                   │    │                │    │                │  │
│  │   Route Handlers  │    │   Middleware   │    │  Email Service │  │
│  │                   │    │                │    │                │  │
│  └───────────────────┘    └────────────────┘    └────────────────┘  │
│                                                                      │
│                      ┌────────────────────┐                          │
│                      │                    │                          │
│                      │    Shared Utils    │                          │
│                      │                    │                          │
│                      └────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Entry Points

- **index.ts**: Express app entry point for Node.js environments
- **worker.ts**: Cloudflare Worker entry point

These files handle environment-specific initialization and routing, but delegate the actual business logic to the shared core.

### 2. Adapters

- **request-response.ts**: Provides common interfaces and adapters for HTTP requests and responses
- **middleware-adapter.ts**: Adapts Express middleware to work with our common request/response types

The adapters allow environment-specific code to interact with our environment-neutral core code.

### 3. Core Business Logic

- **routes.ts**: Contains environment-agnostic route handlers
- **EmailService**: Handles email sending regardless of environment
- **middleware/**: Reusable middleware components

### 4. Shared Utilities

- **logger.ts**: Common logging functionality
- **error-handler.ts**: Unified error handling across environments (includes Express middleware)
- **errors.ts**: Shared error types
- **config/env.js**: Environment configuration

## Request Flow

1. A request comes into either the Express app or Cloudflare Worker
2. The entry point wraps the native request/response in our adapters
3. The request is processed through common middleware
4. Route-specific handlers from the core are invoked
5. The response is converted back to the native format and returned

## Middleware Pipeline

Both environments follow the same middleware pipeline:

1. CORS handling
2. Request logging
3. Security headers
4. Rate limiting
5. Route-specific middleware (e.g., email rate limiting)
6. Route handlers
7. Error handling
8. Not found handling

## Benefits of This Architecture

1. **Reduced Code Duplication**: Core logic is shared across environments
2. **Easier Maintenance**: Changes to business logic only need to be made in one place
3. **Consistent Behavior**: The same middleware pipeline and route handlers ensure consistent behavior
4. **Separation of Concerns**: Environment-specific code is isolated from business logic
5. **Testability**: Core logic can be tested independently of the runtime environment

## Future Improvements

- Further extract common patterns into shared utilities
- Create a more robust middleware registration system
- Implement dependency injection for better testability
- Add more comprehensive error handling and logging ✓
- Add consistent tracing and monitoring support 