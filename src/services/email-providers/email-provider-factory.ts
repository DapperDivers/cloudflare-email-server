import { env } from '../../config/env.js';
import { EmailProvider } from './email-provider.interface.js';
import { MailchannelsProvider } from './mailchannels-provider.js';
import { NodemailerProvider } from './nodemailer-provider.js';

// Logger function for structured logging
const log = {
  info: (message: string, data?: Record<string, unknown>): void => {
    console.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        message,
        ...data,
      })
    );
  },
};

/**
 * Factory for creating email provider instances
 */
export class EmailProviderFactory {
  /**
   * Creates the appropriate email provider based on environment configuration
   * @param isWorkerEnvironment Whether running in a Cloudflare Worker
   * @returns An instance of an email provider
   */
  static createProvider(isWorkerEnvironment = false): EmailProvider {
    // In worker environment, prefer Mailchannels
    if (isWorkerEnvironment && env.EMAIL_PROVIDER === 'mailchannels') {
      log.info('Creating Mailchannels email provider for worker environment');
      return new MailchannelsProvider();
    } 
    
    // Use Nodemailer in non-worker environment or if Mailchannels not configured
    log.info(`Creating Nodemailer email provider (worker: ${isWorkerEnvironment})`);
    return new NodemailerProvider(isWorkerEnvironment);
  }
} 