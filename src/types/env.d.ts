declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      EMAIL_SERVICE: string;
      EMAIL_USER: string;
      EMAIL_PASS: string;
      NODE_ENV?: 'development' | 'production';
    }
  }
}
