import { env } from '@shared-config/env';
import { EmailRequest } from '@shared-schema/api';
import {
  EmailProvider,
  EmailSendResult,
} from '@shared-services/email-providers/email-provider.interface';
import { EmailError } from '@shared-utils/errors';

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

// Type definition for the MailChannels API payload
interface MailChannelsPayload {
  personalizations: Array<{
    to: Array<{ email: string; name?: string }>;
  }>;
  from: {
    email: string;
    name?: string;
  };
  subject: string;
  content: Array<{
    type: string;
    value: string;
  }>;
  reply_to?: {
    email: string;
    name?: string;
  };
  headers?: Record<string, string>;
}

/**
 * Base class for MailChannels email provider
 * Uses MailChannels API with API key authentication
 */
export class MailChannelsProvider implements EmailProvider {
  private readonly apiKey: string;

  constructor(apiKey: string = env.MAILCHANNELS_API_KEY || '') {
    this.apiKey = apiKey;

    // Log API key information for debugging (but don't log the full key)
    const keyLength = this.apiKey ? this.apiKey.length : 0;
    const keyFirstChars = this.apiKey && keyLength > 4 ? this.apiKey.substring(0, 4) : '';
    log.info('MailChannels Provider initialized', {
      hasKey: Boolean(this.apiKey),
      keyLength,
      keyPrefix: keyFirstChars ? `${keyFirstChars}...` : '',
      keyType: typeof this.apiKey,
    });
  }

  /**
   * Initializes the provider
   * For MailChannels, this is a no-op as we don't need long-lived connections
   */
  async initialize(): Promise<void> {
    log.info('Initializing MailChannels provider');
    // No initialization needed for this provider
    return Promise.resolve();
  }

  /**
   * Send an email using MailChannels API
   * @param data Email request data
   * @param ipAddress IP address for logging
   * @returns Email send result
   */
  async sendEmail(data: EmailRequest, ipAddress?: string): Promise<EmailSendResult> {
    const startTime = Date.now();

    try {
      const { name, email, message } = data;

      log.info('Processing email request via MailChannels', {
        ip: ipAddress,
        timestamp: new Date().toISOString(),
      });

      // Validate API key
      this.validateAuthentication();

      // Determine sender information
      const { senderEmail, senderDomain } = this.getSenderInfo();

      // Create the email payload
      const mailchannelsPayload = this.createEmailPayload({
        senderEmail,
        senderDomain,
        recipientName: name,
        recipientEmail: email,
        message,
      });

      // Send the email
      log.info('Sending email via MailChannels...', {
        to: email,
        from: senderEmail,
        subject: `New Contact Form Submission from ${name}`,
      });

      const messageId = await this.sendToMailChannels(mailchannelsPayload);

      const duration = Date.now() - startTime;

      log.info('Email sent successfully via MailChannels', {
        recipientEmail: email,
        duration,
      });

      return {
        success: true,
        messageId: messageId || `mc-${Date.now()}`,
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
   * Validate that the MailChannels API key is available
   * @throws Error if API key is missing or malformed
   */
  private validateAuthentication(): void {
    if (!this.apiKey) {
      throw new Error(
        'MailChannels API key is missing. Please set the MAILCHANNELS_API_KEY environment variable.'
      );
    }

    // Check for control characters or invalid API key format
    if (this.apiKey.length < 8 || /[^\x20-\x7E]/.test(this.apiKey)) {
      throw new Error(
        'MailChannels API key appears to be malformed. Please check the MAILCHANNELS_API_KEY environment variable.'
      );
    }
  }

  /**
   * Determine sender email and domain based on environment configuration
   * @returns Object containing sender email and domain
   */
  private getSenderInfo(): { senderEmail: string; senderDomain: string } {
    let senderDomain: string;
    let senderEmail: string;

    // First determine the domain
    if (env.MAILCHANNELS_SENDER_DOMAIN) {
      senderDomain = env.MAILCHANNELS_SENDER_DOMAIN;
      log.info('Using configured sender domain', { domain: senderDomain });
    } else {
      // Extract domain from CORS_ORIGIN as fallback
      const corsUrl = new URL(
        env.CORS_ORIGIN.startsWith('http') ? env.CORS_ORIGIN : `https://${env.CORS_ORIGIN}`
      );
      senderDomain = corsUrl.hostname;
      log.info('Using domain from CORS_ORIGIN for email sending', { domain: senderDomain });
    }

    // Then determine the email
    if (env.MAILCHANNELS_SENDER_EMAIL) {
      senderEmail = env.MAILCHANNELS_SENDER_EMAIL;
      log.info('Using configured sender email', { email: senderEmail });
    } else {
      senderEmail = `noreply@${senderDomain}`;
      log.info('Using generated sender email', { email: senderEmail });
    }

    return { senderEmail, senderDomain };
  }

  /**
   * Create the email payload for the MailChannels API
   * @param params Object containing email parameters
   * @returns MailChannels API payload
   */
  private createEmailPayload(params: {
    senderEmail: string;
    senderDomain: string;
    recipientName: string;
    recipientEmail: string;
    message: string;
  }): MailChannelsPayload {
    const { senderEmail, senderDomain, recipientName, recipientEmail, message } = params;

    // Create base payload - MailChannels will handle DKIM signing automatically
    const payload: MailChannelsPayload = {
      personalizations: [
        {
          to: [{ email: env.EMAIL_USER, name: 'Site Admin' }],
        },
      ],
      from: {
        email: senderEmail,
        name: 'Contact Form',
      },
      subject: `New Contact Form Submission from ${recipientName}`,
      content: [
        {
          type: 'text/plain',
          value: `SaraEngland.com Contact Submission\n\nFrom: ${recipientName} <${recipientEmail}>\n\nMessage:\n${message}`,
        },
        {
          type: 'text/html',
          value: `
            <h2>Submission from ${recipientName}</h2>
            <p><strong>From:</strong> ${recipientName} &lt;${recipientEmail}&gt;</p>
            <p><strong>Message:</strong></p>
            <div style="margin-left: 20px; padding: 10px; border-left: 4px solid #ccc;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          `.trim(),
        },
      ],
      reply_to: {
        email: recipientEmail,
        name: recipientName,
      },
      headers: {},
    };

    log.info('Using MailChannels automatic DKIM signing', { domain: senderDomain });

    return payload;
  }

  /**
   * Send the email via the MailChannels API
   * @param payload MailChannels API payload
   * @returns A promise resolving to the message ID or null if not available
   * @throws Error if the API request fails
   */
  private async sendToMailChannels(payload: MailChannelsPayload): Promise<string | null> {
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };

    // Log the full request for debugging
    log.info('MailChannels API request details', {
      url: 'https://api.mailchannels.net/tx/v1/send',
      headers: JSON.stringify({ ...headers, 'X-API-Key': '[REDACTED]' }),
      payload: JSON.stringify(payload),
    });

    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('MailChannels API error details', new Error(errorText), {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
      });
      throw new Error(`MailChannels API error: ${response.status} ${errorText}`);
    }

    try {
      // Type the JSON response
      const jsonResponse = (await response.json()) as { id?: string };
      return jsonResponse?.id || null;
    } catch (error) {
      log.warn('Could not parse JSON response from MailChannels', { error });
      return null;
    }
  }
}
