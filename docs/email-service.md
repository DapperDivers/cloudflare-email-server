# Email Service Documentation

The `EmailService` class is the central component of the email system, responsible for managing email providers and handling the email sending process.

## Architecture Overview

The email service architecture follows these design principles:

1. **Separation of Concerns**: The service delegates actual email sending to provider implementations
2. **Factory Pattern**: Uses `EmailProviderFactory` to create the appropriate provider
3. **Lifecycle Management**: Handles initialization and cleanup of providers
4. **Environment Awareness**: Adapts behavior based on the runtime environment (Worker vs. Node.js)

```
┌─────────────────┐     ┌───────────────────────┐     ┌───────────────────┐
│                 │     │                       │     │                   │
│   API Request   │────▶│     EmailService      │────▶│  EmailProvider    │
│                 │     │                       │     │   (Interface)     │
└─────────────────┘     └───────────────────────┘     └─────────┬─────────┘
                                                                │
                                                                │
                                ┌────────────────┬──────────────┴───────────────┐
                                │                │                              │
                                ▼                ▼                              ▼
                        ┌───────────────┐ ┌──────────────────┐ ┌────────────────────────┐
                        │ Nodemailer    │ │ MailChannels     │ │ MailChannels           │
                        │ Provider      │ │ API Key Provider │ │ Worker Auth Provider   │
                        └───────────────┘ └──────────────────┘ └────────────────────────┘
```

## Usage Example

### Basic Usage

```typescript
// Create an email service instance
const emailService = new EmailService();

// Initialize the service (not needed in Worker environments)
await emailService.initialize();

// Send an email
const result = await emailService.sendEmail({
  name: 'John Doe',
  email: 'john@example.com',
  message: 'Hello, this is a test message'
});

// Clean up resources when done
await emailService.close();
```

### Worker Environment

```typescript
// In a Cloudflare Worker
export async function handleRequest(request: Request): Promise<Response> {
  const emailService = new EmailService(true); // true indicates Worker environment
  
  const data = await request.json();
  
  try {
    const result = await emailService.sendEmail(data, request.headers.get('CF-Connecting-IP'), true);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## API Reference

### Constructor

```typescript
constructor(isWorkerEnvironment = false)
```

- **Parameters**:
  - `isWorkerEnvironment`: Boolean indicating if running in a Cloudflare Worker

### Methods

#### initialize()

```typescript
async initialize(): Promise<void>
```

Initializes the email provider. Must be called before using `sendEmail` in non-worker environments.

- **Returns**: Promise that resolves when initialization is complete
- **Throws**: `EmailError` if initialization fails

#### sendEmail()

```typescript
async sendEmail(
  data: EmailRequest,
  ipAddress?: string,
  isWorkerEnvironment = false
): Promise<EmailResponse>
```

Sends an email using the configured provider.

- **Parameters**:
  - `data`: Object containing email request data (name, email, message)
  - `ipAddress`: Optional IP address for logging
  - `isWorkerEnvironment`: Whether this is being called from a Worker
- **Returns**: Promise resolving to an object with success/failure info
- **Throws**: `EmailError` if sending fails

#### close()

```typescript
async close(): Promise<void>
```

Closes the provider connection and cleans up resources.

- **Returns**: Promise that resolves when cleanup is complete

## Environment-Specific Behavior

### Node.js Environment

In a Node.js environment:
1. The `initialize()` method must be called before sending emails
2. The provider is created once and reused for subsequent email requests
3. The `close()` method should be called to clean up resources

### Cloudflare Worker Environment

In a Worker environment:
1. No need to call `initialize()` explicitly
2. A new provider is created for each email request
3. The `isWorkerEnvironment` parameter should be set to `true`
4. Special consideration is given to providers that may not fully work in Workers

## Error Handling

The EmailService provides the following error handling:

1. **Input Validation**: Validates request data against the `EmailRequestSchema`
2. **Provider Errors**: Catches and wraps provider-specific errors
3. **Structured Logging**: Logs detailed error information
4. **EmailError**: Throws a consistent error type for all failures

## Logging and Monitoring

The service includes structured logging with the following log levels:

- **Info**: Service initialization, email sending attempts, etc.
- **Error**: Failed email attempts, configuration issues, etc.
- **Warn**: Non-critical issues that may require attention

All logs include timestamps and contextual information.

## Future Improvements

See the [Email Provider Improvements](./email-provider-improvements.md) document for a list of planned improvements to the email service. 