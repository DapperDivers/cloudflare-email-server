# Worker-Specific Utilities

This directory contains utilities specific to the Cloudflare Worker environment.

## Error Handling

The Worker-specific error handling utilities include:

- `workerErrorHandler`: Error handler for Worker routes
- `asyncWorkerHandler`: Wrapper for async Worker route handlers to properly catch and handle Promise rejections

These utilities build on the shared error handling utilities but are specifically designed for Cloudflare Workers.

## Usage

Import these utilities directly from the Worker package:

```typescript
import { workerErrorHandler, asyncWorkerHandler } from '@utils/error-handler';
```

Or through the central utilities export:

```typescript
import { workerErrorHandler, asyncWorkerHandler } from '@utils';
```

### Error Handler

Use the error handler in your Worker routes:

```typescript
try {
  // Your code here
} catch (error) {
  workerErrorHandler(error, req, res);
}
```

### Async Handler

Wrap async route handlers to properly catch and handle Promise rejections:

```typescript
const handler = asyncWorkerHandler(async (req, res) => {
  // Your async code here
  const data = await someAsyncFunction();
  res.json(data);
});
``` 