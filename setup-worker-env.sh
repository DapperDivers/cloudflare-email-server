#!/bin/bash
# Script to set up Cloudflare Worker environment variables from .env file

# Load environment variables from .env file
source .env

# Set sensitive information as secrets
echo "Setting up email configuration secrets..."
npx wrangler secret put EMAIL_SERVICE --env production <<< "$EMAIL_SERVICE"
npx wrangler secret put EMAIL_USER --env production <<< "$EMAIL_USER"
npx wrangler secret put CORS_ORIGIN --env production <<< "$CORS_ORIGIN"
npx wrangler secret put EMAIL_PROVIDER --env production <<< "${EMAIL_PROVIDER:-nodemailer}"

# OAuth2 configuration
echo "Setting up OAuth2 configuration secrets..."
npx wrangler secret put OAUTH2_CLIENT_ID --env production <<< "$OAUTH2_CLIENT_ID"
npx wrangler secret put OAUTH2_CLIENT_SECRET --env production <<< "$OAUTH2_CLIENT_SECRET"
npx wrangler secret put OAUTH2_REFRESH_TOKEN --env production <<< "$OAUTH2_REFRESH_TOKEN"

# Mailchannels configuration (if using)
if [ "${EMAIL_PROVIDER:-nodemailer}" = "mailchannels" ] && [ -n "$DKIM_PRIVATE_KEY" ]; then
  echo "Setting up Mailchannels DKIM configuration..."
  npx wrangler secret put DKIM_PRIVATE_KEY --env production <<< "$DKIM_PRIVATE_KEY"
fi

echo "Environment variables have been set up successfully!" 