#!/bin/bash
# Script to set up Cloudflare Worker environment variables from .env file

# Load environment variables from .env file
source .env

# Helper function to securely set a secret if it exists
set_secret_if_exists() {
  local key=$1
  local value=$2
  
  if [ -n "$value" ]; then
    echo "Setting $key..."
    npx wrangler secret put "$key" --env production <<< "$value"
  else
    echo "Skipping $key (not set or empty)"
  fi
}

# Set sensitive information as secrets only if they exist
echo "Setting up email configuration secrets..."
set_secret_if_exists "EMAIL_SERVICE" "$EMAIL_SERVICE"
set_secret_if_exists "EMAIL_USER" "$EMAIL_USER"
set_secret_if_exists "CORS_ORIGIN" "$CORS_ORIGIN"
set_secret_if_exists "EMAIL_PROVIDER" "${EMAIL_PROVIDER:-nodemailer}"

# OAuth2 configuration
echo "Setting up OAuth2 configuration secrets..."
set_secret_if_exists "OAUTH2_CLIENT_ID" "$OAUTH2_CLIENT_ID"
set_secret_if_exists "OAUTH2_CLIENT_SECRET" "$OAUTH2_CLIENT_SECRET"
set_secret_if_exists "OAUTH2_REFRESH_TOKEN" "$OAUTH2_REFRESH_TOKEN"

# Mailchannels configuration (if using)
if [ "${EMAIL_PROVIDER:-nodemailer}" = "mailchannels" ]; then
  echo "Setting up Mailchannels configuration..."
  
  set_secret_if_exists "DKIM_PRIVATE_KEY" "$DKIM_PRIVATE_KEY"
  set_secret_if_exists "MAILCHANNELS_API_KEY" "$MAILCHANNELS_API_KEY"
  set_secret_if_exists "MAILCHANNELS_SENDER_DOMAIN" "$MAILCHANNELS_SENDER_DOMAIN"
  set_secret_if_exists "MAILCHANNELS_SENDER_EMAIL" "$MAILCHANNELS_SENDER_EMAIL"
fi

echo "Environment variables have been set up successfully!" 