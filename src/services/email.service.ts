import { EmailRequestSchema, type EmailRequest } from '@schema/api';
import { EmailError } from '@utils/errors';
import { EmailProvider, EmailSendResult } from './email-providers/email-provider.interface';
import { EmailProviderFactory } from './email-providers/email-provider-factory';
import { env } from '@config/env';

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
  duration?: number;
}

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
  error: (message: string, error: Error, data?: Record<string, unknown>): void => {
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message,
        error: {
          name: error.name,
          message: error.message,
          stack: env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        ...data,
      })
    );
  },
  warn: (message: string, data?: Record<string, unknown>): void => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message,
        ...data,
      })
    );
  },
};

export class EmailService {
  private provider: EmailProvider | null = null;
  private isInitialized: boolean = false;

  /**
   * Creates a new EmailService instance
   * @param isWorkerEnvironment Whether running in a Cloudflare Worker
   */
  constructor(private isWorkerEnvironment = false) {}

  /**
   * Initializes the email provider
   * This must be called before using sendEmail in non-worker environments
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      this.provider = EmailProviderFactory.createProvider(this.isWorkerEnvironment);
      
      // Initialize the provider if it has an initialize method
      if (this.provider.initialize) {
        await this.provider.initialize();
      }

      this.isInitialized = true;
      log.info('Email service initialized successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown email configuration error');
      log.error('Email service initialization failed', err);
      throw new EmailError(err.message);
    }
  }

  /**
   * Sends an email using the configured provider
   * @param data The email request data (name, email, message)
   * @param ipAddress Optional IP address for logging
   * @param isWorkerEnvironment Whether this is being called from a Cloudflare Worker
   * @returns An object indicating success or failure
   */
  async sendEmail(
    data: EmailRequest,
    ipAddress?: string,
    isWorkerEnvironment = false
  ): Promise<EmailResponse> {
    const startTime = Date.now();

    try {
      // Validate and sanitize input
      const validatedData = await EmailRequestSchema.parseAsync(data);
      
      // If we're in a worker environment, or provider is not initialized, create a new provider
      if (isWorkerEnvironment || !this.provider) {
        this.provider = EmailProviderFactory.createProvider(isWorkerEnvironment);
      }

      if (!this.provider) {
        throw new Error('Email provider not initialized');
      }

      // Send the email using the provider
      const result = await this.provider.sendEmail(validatedData, ipAddress);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInstance = error instanceof Error ? error : new Error('Unknown error occurred');
      
      log.error('Email sending failed', errorInstance, { 
        ip: ipAddress,
        duration
      });
      
      if (error instanceof EmailError) {
        throw error;
      }
      
      throw new EmailError(errorInstance.message);
    }
  }

  /**
   * Closes the provider connection, if necessary
   */
  async close(): Promise<void> {
    if (this.provider && this.provider.close) {
      await this.provider.close();
    }
    this.isInitialized = false;
    this.provider = null;
  }
} 