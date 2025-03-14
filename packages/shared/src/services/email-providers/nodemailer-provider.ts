import nodemailer, { Transporter } from 'nodemailer';

import { env } from '@shared-config/env';
import { EmailRequest } from '@shared-schema/api';
import {
  EmailProvider,
  EmailSendResult,
} from '@shared-services/email-providers/email-provider.interface';
import { EmailError } from '@shared-utils/errors';
import { createOAuth2Transport } from '@shared-utils/oauth2';

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

/**
 * Nodemailer email provider
 * Uses OAuth2 authentication for sending emails
 */
export class NodemailerProvider implements EmailProvider {
  private transporter: Transporter | null = null;
  private isInitialized: boolean = false;
  private isWorkerEnvironment: boolean = false;

  /**
   * Creates a new NodemailerProvider instance
   * @param isWorkerEnvironment Whether running in a Cloudflare Worker
   */
  constructor(isWorkerEnvironment = false) {
    this.isWorkerEnvironment = isWorkerEnvironment;
  }

  /**
   * Initializes the Nodemailer transporter
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      if (!env.OAUTH2_CLIENT_ID || !env.OAUTH2_CLIENT_SECRET || !env.OAUTH2_REFRESH_TOKEN) {
        const err = new Error(
          'OAuth2 credentials missing. This provider requires OAuth2 authentication.'
        );
        log.error('Email service configuration failed', err, {
          service: env.EMAIL_SERVICE,
          user: env.EMAIL_USER,
        });
        throw new EmailError(err.message);
      }

      log.info('Setting up email transport with OAuth2');
      this.transporter = await createOAuth2Transport();

      // Verify email configuration
      await this.transporter.verify();
      log.info('Email service configured', {
        service: env.EMAIL_SERVICE,
        user: env.EMAIL_USER,
        authType: 'OAuth2',
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
    if (!env.OAUTH2_CLIENT_ID || !env.OAUTH2_CLIENT_SECRET || !env.OAUTH2_REFRESH_TOKEN) {
      const err = new Error(
        'OAuth2 credentials missing. This provider requires OAuth2 authentication.'
      );
      log.error('Email service configuration failed', err, {
        service: env.EMAIL_SERVICE,
        user: env.EMAIL_USER,
      });
      throw new EmailError(err.message);
    }

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
  }

  /**
   * Send an email using Nodemailer with OAuth2
   * @param data Email request data
   * @param ipAddress IP address for logging
   * @returns Email send result
   */
  async sendEmail(data: EmailRequest, ipAddress?: string): Promise<EmailSendResult> {
    const startTime = Date.now();

    try {
      const { name, email, message } = data;

      log.info('Processing email request via Nodemailer', {
        ip: ipAddress,
        timestamp: new Date().toISOString(),
      });

      log.info('Email validation passed', {
        recipientEmail: email,
      });

      // Make sure we have a transporter
      if (!this.transporter && !this.isWorkerEnvironment) {
        await this.initialize();
      }

      // In worker environment, create a new transporter each time
      const transporter = this.isWorkerEnvironment
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
      log.info('Sending email via Nodemailer...', {
        to: env.EMAIL_USER,
        from: env.EMAIL_USER,
        subject: mailOptions.subject,
      });

      const info = await transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      log.info('Email sent successfully via Nodemailer', {
        recipientEmail: email,
        duration,
        messageId: info.messageId,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        messageId: info.messageId || null,
        error: null,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInstance = error instanceof Error ? error : new Error('Unknown error occurred');

      log.error('Email sending failed', errorInstance, {
        ip: ipAddress,
        duration,
      });

      if (error instanceof EmailError) {
        throw error;
      }

      return {
        success: false,
        messageId: null,
        error: errorInstance,
      };
    }
  }

  /**
   * Closes the transporter connection
   */
  async close(): Promise<void> {
    if (this.transporter && typeof this.transporter.close === 'function') {
      await this.transporter.close();
    }
    this.isInitialized = false;
    this.transporter = null;
  }
}
