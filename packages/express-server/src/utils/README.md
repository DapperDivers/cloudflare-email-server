# Express-Specific Utilities

This directory contains utilities specific to the Express environment.

## Error Handling

The Express-specific error handling utilities include:

- `expressErrorHandler`: Express middleware for standardized error handling
- `asyncExpressHandler`: Wrapper for async Express route handlers to properly catch and handle Promise rejections

These utilities build on the shared error handling utilities but are specifically designed for Express applications.

## Usage

Import these utilities directly from the Express package:

```typescript
import { expressErrorHandler, asyncExpressHandler } from '@utils/error-handler';
```

Or through the central utilities export:

```typescript
import { expressErrorHandler, asyncExpressHandler } from '@utils';
```

### Error Handler Middleware

Add the error handler middleware to your Express app:

```typescript
app.use(expressErrorHandler);
```

### Async Handler

Wrap async route handlers to properly catch and handle Promise rejections:

```typescript
app.get('/api/resource', asyncExpressHandler(async (req, res) => {
  // Your async code here
  const data = await someAsyncFunction();
  res.json(data);
}));
``` 