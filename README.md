# Cloudflare Email Server

A secure and efficient email server built with Express.js and TypeScript, designed to handle contact form submissions and email notifications.

## Features

- Secure email handling with rate limiting
- Input validation and sanitization
- CORS protection
- Structured logging
- TypeScript support
- Comprehensive error handling
- Environment-based configuration

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Cloudflare account (for deployment)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cloudflare-email-server.git
cd cloudflare-email-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=https://your-domain.com
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=5
```

## Development

Start the development server:
```bash
npm run dev
```

## Testing

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Cloudflare Workers Deployment

This project is configured to deploy to Cloudflare Workers using Wrangler.

### Prerequisites

- Node.js 20+
- npm
- A Cloudflare account with Workers enabled
- Wrangler CLI installed and authenticated

### Set Up

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   npm run worker:secrets
   ```
   This will prompt you to enter values for:
   - EMAIL_USER
   - EMAIL_PASS
   - CORS_ORIGIN
   - EMAIL_SERVICE

### Development

To run the worker in development mode:

```bash
npm run worker:dev
```

This will start a local development server that mimics the Cloudflare Workers environment.

### Deployment

To deploy to Cloudflare Workers:

```bash
# Default environment
npm run worker:deploy

# Production environment
npm run worker:deploy:production

# Staging environment
npm run worker:deploy:staging
```

### Configuration

The worker configuration is defined in `wrangler.toml`. You can modify this file to change settings like:

- Worker name
- Environment variables
- Deployment targets
- Triggers

For more information about Wrangler configuration, see the [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/configuration/).

## API Endpoints

### POST /api/send-email

Send an email through the contact form.

Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello, this is a test message."
}
```

Response:
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

## Security Features

- Rate limiting to prevent abuse
- CORS protection
- Input validation and sanitization
- Security headers
- Error handling and logging

## License

ISC 