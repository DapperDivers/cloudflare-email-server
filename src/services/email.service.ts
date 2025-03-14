import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { EmailRequestSchema, type EmailRequest } from '../schema/api.js';
import { EmailError } from '../utils/errors.js';
import { createOAuth2Transport } from '../utils/oauth2.js';

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
  private transporter: Transporter | null = null;
  private isInitialized: boolean = false;

  /**
   * Creates a new EmailService instance
   */
  constructor() {}

  /**
   * Initializes the email transporter
   * This must be called before using sendEmail
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      if (env.OAUTH2_CLIENT_ID && env.OAUTH2_CLIENT_SECRET && env.OAUTH2_REFRESH_TOKEN) {
        log.info('Setting up email transport with OAuth2');
        this.transporter = await createOAuth2Transport();
      } else {
        log.info('Setting up email transport with password auth');
        this.transporter = nodemailer.createTransport({
          service: env.EMAIL_SERVICE,
          auth: {
            user: env.EMAIL_USER,
            pass: env.EMAIL_PASS,
          },
        });
      }

      // Verify email configuration
      await this.transporter.verify();
      log.info('Email service configured', {
        service: env.EMAIL_SERVICE,
        user: env.EMAIL_USER,
        authType: env.OAUTH2_CLIENT_ID ? 'OAuth2' : 'Password',
      });

      this.isInitialized = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown email configuration error');
      log.error('Email service configuration failed', err, {
        service: env.EMAIL_SERVICE,
        user: env.EMAIL_USER,
      });
      throw new EmailError(err.message);
    }
  }

  /**
   * Creates a transporter for Cloudflare Worker environment with simplified OAuth2 approach
   * @returns Nodemailer transporter instance
   */
  private createWorkerTransport(): Transporter {
    if (env.OAUTH2_CLIENT_ID && env.OAUTH2_CLIENT_SECRET && env.OAUTH2_REFRESH_TOKEN) {
      log.info('Using OAuth2 for email transport in worker environment');
      return nodemailer.createTransport({
        service: env.EMAIL_SERVICE,
        auth: {
          type: 'OAuth2',
          user: env.EMAIL_USER,
          clientId: env.OAUTH2_CLIENT_ID,
          clientSecret: env.OAUTH2_CLIENT_SECRET,
          refreshToken: env.OAUTH2_REFRESH_TOKEN,
        },
      });
    } else {
      log.info('Using password auth for email transport in worker environment');
      return nodemailer.createTransport({
        service: env.EMAIL_SERVICE,
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        },
      });
    }
  }

  /**
   * Sends an email using the configured transporter
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
      // Log incoming email request
      log.info('Processing email request', {
        ip: ipAddress,
        timestamp: new Date().toISOString(),
      });

      // Validate and sanitize input
      const validatedData = await EmailRequestSchema.parseAsync(data);
      const { name, email, message } = validatedData;

      log.info('Email validation passed', {
        recipientEmail: email,
        timestamp: new Date().toISOString(),
      });

      // Make sure we have a transporter
      if (!this.transporter && !isWorkerEnvironment) {
        await this.initialize();
      }

      // In worker environment, create a new transporter each time
      const transporter = isWorkerEnvironment 
        ? this.createWorkerTransport() 
        : this.transporter;

      if (!transporter) {
        throw new Error('Email transport not initialized');
      }

      // Prepare email content
      const mailOptions = {
        from: env.EMAIL_USER,
        to: env.EMAIL_USER,
        subject: `New Contact Form Submission from ${name}`,
        text: `
Name: ${name}
Email: ${email}
Message: ${message}
        `,
        replyTo: email,
      };

      // Send email
      log.info('Sending email...', { 
        to: env.EMAIL_USER,
        from: env.EMAIL_USER,
        subject: mailOptions.subject 
      });
      
      const info = await transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;
      
      log.info('Email sent successfully', {
        recipientEmail: email,
        duration,
        messageId: info.messageId,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully',
        duration
      };
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
   * Closes the transporter connection, if necessary
   */
  async close(): Promise<void> {
    if (this.transporter && typeof this.transporter.close === 'function') {
      await this.transporter.close();
    }
    this.isInitialized = false;
    this.transporter = null;
  }
} 