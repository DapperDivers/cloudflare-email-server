import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { env } from '../config/env.js';

// Create OAuth2 client
const createOAuth2Client = () => {
  const oauth2Client = new google.auth.OAuth2(
    env.OAUTH2_CLIENT_ID,
    env.OAUTH2_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // Redirect URL
  );

  // Set refresh token
  oauth2Client.setCredentials({
    refresh_token: env.OAUTH2_REFRESH_TOKEN
  });

  return oauth2Client;
};

/**
 * Get a new access token using the refresh token
 * @returns {Promise<string>} The new access token
 */
export const getAccessToken = async (): Promise<string> => {
  try {
    const oauth2Client = createOAuth2Client();
    const { token } = await oauth2Client.getAccessToken();
    
    if (!token) {
      throw new Error('Failed to retrieve access token');
    }
    
    return token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw new Error('OAuth2 authentication failed');
  }
};

/**
 * Configure nodemailer transport with OAuth2
 * @returns {nodemailer.Transporter} Configured nodemailer transporter
 */
export const createOAuth2Transport = async (): Promise<nodemailer.Transporter> => {
  try {
    // Get access token
    const accessToken = await getAccessToken();
    
    // Create and return the transport
    const transport = nodemailer.createTransport({
      service: env.EMAIL_SERVICE,
      auth: {
        type: 'OAuth2',
        user: env.EMAIL_USER,
        clientId: env.OAUTH2_CLIENT_ID,
        clientSecret: env.OAUTH2_CLIENT_SECRET,
        refreshToken: env.OAUTH2_REFRESH_TOKEN,
        accessToken
      }
    });
    
    return transport;
  } catch (error) {
    console.error('Error creating OAuth2 transport:', error);
    throw new Error('Failed to create email transport with OAuth2');
  }
}; 