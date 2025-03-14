import { EmailRequest } from '../../schema/api.js';
import { env } from '../../config/env.js';
import { EmailProvider, EmailSendResult } from './email-provider.interface.js';
import { EmailError } from '../../utils/errors.js';

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
 * Mailchannels email provider for Cloudflare Workers
 * Uses Mailchannels API (https://api.mailchannels.net/tx/v1/send)
 */
export class MailchannelsProvider implements EmailProvider {
  /**
   * Send an email using Mailchannels in Cloudflare Workers
   * @param data Email request data
   * @param ipAddress IP address for logging
   * @returns Email send result
   */
  async sendEmail(data: EmailRequest, ipAddress?: string): Promise<EmailSendResult> {
    const startTime = Date.now();
    
    try {
      const { name, email, message } = data;
      
      log.info('Processing email request via Mailchannels', {
        ip: ipAddress,
        timestamp: new Date().toISOString(),
      });
      
      log.info('Email validation passed', {
        recipientEmail: email,
      });
      
      // Extract domain from CORS_ORIGIN
      // Handle URLs with and without paths, extract just the domain portion
      const corsUrl = new URL(env.CORS_ORIGIN.startsWith('http') ? env.CORS_ORIGIN : `https://${env.CORS_ORIGIN}`);
      const domain = corsUrl.hostname;
      
      log.info('Using domain for email sending', { domain, corsOrigin: env.CORS_ORIGIN });
      
      // Simple email payload without DKIM configuration directly in the payload
      // Following MailChannels documentation
      const mailchannelsPayload = {
        personalizations: [
          {
            to: [{ email: env.EMAIL_USER, name: 'Contact Form' }],
          },
        ],
        from: {
          email: `noreply@${domain}`,
          name: 'Contact Form',
        },
        subject: `New Contact Form Submission from ${name}`,
        content: [
          {
            type: 'text/plain',
            value: `
Name: ${name}
Email: ${email}
Message: ${message}
            `,
          },
        ],
        reply_to: {
          email: email,
          name: name,
        },
      };
      
      log.info('Sending email via Mailchannels...', {
        to: env.EMAIL_USER,
        from: `noreply@${domain}`,
        subject: `New Contact Form Submission from ${name}`,
        domain: domain,
      });
      
      // Send email using Mailchannels API
      const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mailchannelsPayload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log.error('MailChannels API error details', new Error(errorText), {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        throw new Error(`Mailchannels API error: ${response.status} ${errorText}`);
      }
      
      const duration = Date.now() - startTime;
      
      log.info('Email sent successfully via Mailchannels', {
        recipientEmail: email,
        duration,
        timestamp: new Date().toISOString(),
      });
      
      return {
        success: true,
        message: 'Email sent successfully',
        duration,
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
      
      throw new EmailError(errorInstance.message);
    }
  }
} 