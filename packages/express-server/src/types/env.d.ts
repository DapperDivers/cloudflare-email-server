declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      EMAIL_SERVICE: string;
      EMAIL_USER: string;
      EMAIL_PASS?: string;
      NODE_ENV?: 'development' | 'production';
      OAUTH2_CLIENT_ID?: string;
      OAUTH2_CLIENT_SECRET?: string;
      OAUTH2_REFRESH_TOKEN?: string;
      OAUTH2_ACCESS_TOKEN?: string;
      MAILCHANNELS_API_KEY?: string;
      MAILCHANNELS_SENDER_DOMAIN?: string;
      MAILCHANNELS_SENDER_EMAIL?: string;
    }
  }
}
