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