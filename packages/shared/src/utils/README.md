# Shared Utilities

This directory contains environment-agnostic utility functions and classes that are shared between Express and Worker environments.

## Error Handling

The shared error handling utilities include:

- `createErrorResponse`: Creates a standardized error response object with appropriate status code and error details
- `handleError`: Converts any error to a proper Error object

These utilities are used by both Express and Worker environments to provide consistent error handling across the application.

## Usage

Import these utilities directly from the shared package:

```typescript
import { handleError, createErrorResponse } from 'shared/src/utils/error-handler';
```

Then, implement environment-specific error handlers that use these utilities to provide consistent error handling. 