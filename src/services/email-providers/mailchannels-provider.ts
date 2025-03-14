import { EmailRequest } from '@schema/api';
import { env } from '@config/env';
import { EmailProvider, EmailSendResult } from './email-provider.interface';
import { EmailError } from '@utils/errors';

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
  dkim_domain?: string;
  dkim_selector?: string;
  dkim_private_key?: string;
}

/**
 * Base class for MailChannels email providers
 * Uses MailChannels API (https://api.mailchannels.net/tx/v1/send)
 */
export abstract class MailChannelsProviderBase implements EmailProvider {
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
      
      // Perform any authentication-specific validation
      this.validateAuthentication();
      
      // Determine sender information
      const { senderEmail, senderDomain } = this.getSenderInfo();
      
      // Create the email payload
      const mailchannelsPayload = this.createEmailPayload({
        senderEmail,
        senderDomain,
        recipientEmail: env.EMAIL_USER,
        name,
        email,
        message
      });
      
      // Allow authentication-specific modifications to the payload
      this.modifyPayload(mailchannelsPayload);
      
      // Send the email
      log.info('Sending email via MailChannels...', {
        to: env.EMAIL_USER,
        from: senderEmail,
        subject: `New Contact Form Submission from ${name}`,
      });
      
      const response = await this.sendToMailChannels(mailchannelsPayload);
      
      const duration = Date.now() - startTime;
      
      log.info('Email sent successfully via MailChannels', {
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
  
  /**
   * Validate that authentication requirements are met
   * @throws Error if authentication requirements are not met
   */
  protected abstract validateAuthentication(): void;
  
  /**
   * Allow authentication-specific modifications to the payload
   * @param payload The MailChannels payload to modify
   */
  protected abstract modifyPayload(payload: MailChannelsPayload): void;
  
  /**
   * Get headers for the MailChannels API request
   * @returns Headers for the API request
   */
  protected abstract getRequestHeaders(): Record<string, string>;
  
  /**
   * Determine sender email and domain based on environment configuration
   * @returns Object containing sender email and domain
   */
  protected getSenderInfo(): { senderEmail: string; senderDomain: string } {
    let senderDomain: string;
    let senderEmail: string;
    
    // First determine the domain
    if (env.MAILCHANNELS_SENDER_DOMAIN) {
      senderDomain = env.MAILCHANNELS_SENDER_DOMAIN;
      log.info('Using configured sender domain', { domain: senderDomain });
    } else {
      // Extract domain from CORS_ORIGIN as fallback
      const corsUrl = new URL(env.CORS_ORIGIN.startsWith('http') ? env.CORS_ORIGIN : `https://${env.CORS_ORIGIN}`);
      senderDomain = corsUrl.hostname;
      log.info('Using domain from CORS_ORIGIN for email sending', { domain: senderDomain });
    }
    
    // Then determine the email
    if (env.MAILCHANNELS_SENDER_EMAIL) {
      senderEmail = env.MAILCHANNELS_SENDER_EMAIL;
      
      // Update domain to match the email domain for DKIM signing
      senderDomain = senderEmail.split('@')[1];
      
      log.info('Using configured sender email and its domain', { 
        email: senderEmail,
        domain: senderDomain
      });
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
  protected createEmailPayload(params: {
    senderEmail: string;
    senderDomain: string;
    recipientEmail: string;
    name: string;
    email: string;
    message: string;
  }): MailChannelsPayload {
    const { senderEmail, senderDomain, recipientEmail, name, email, message } = params;
    
    // Create base payload
    const payload: MailChannelsPayload = {
      personalizations: [
        {
          to: [{ email: recipientEmail }],
        },
      ],
      from: {
        email: senderEmail,
        name: 'Contact Form',
      },
      subject: `New Contact Form Submission from ${name}`,
      content: [
        {
          type: "text/plain",
          value: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
        }
      ],
      reply_to: {
        email: email,
        name: name
      },
      headers: {}
    };
    
    // Add DKIM if available
    if (env.DKIM_PRIVATE_KEY) {
      payload.dkim_domain = senderDomain;
      payload.dkim_selector = "mailchannels";
      payload.dkim_private_key = env.DKIM_PRIVATE_KEY;
      
      log.info('DKIM configuration added', { domain: senderDomain });
    }
    
    return payload;
  }
  
  /**
   * Send the email via the MailChannels API
   * @param payload MailChannels API payload
   * @throws Error if the API request fails
   */
  protected async sendToMailChannels(payload: MailChannelsPayload): Promise<void> {
    const headers = {
      'Content-Type': 'application/json',
      ...this.getRequestHeaders()
    };
    
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
        url: response.url
      });
      throw new Error(`MailChannels API error: ${response.status} ${errorText}`);
    }
  }
}

/**
 * MailChannels provider using API key authentication
 */
export class MailChannelsApiKeyProvider extends MailChannelsProviderBase {
  /**
   * Validate that the MailChannels API key is available
   * @throws Error if API key is missing
   */
  protected validateAuthentication(): void {
    if (!env.MAILCHANNELS_API_KEY) {
      throw new Error('MailChannels API key is missing. Please set the MAILCHANNELS_API_KEY environment variable.');
    }
  }
  
  /**
   * API Key authentication doesn't require payload modifications
   */
  protected modifyPayload(payload: MailChannelsPayload): void {
    // No modifications needed for API key authentication
  }
  
  /**
   * Get headers for API key authentication
   * @returns Headers for the API request
   */
  protected getRequestHeaders(): Record<string, string> {
    return {
      'X-API-Key': env.MAILCHANNELS_API_KEY!
    };
  }
}

/**
 * MailChannels provider using Cloudflare Worker authentication (domain lockdown)
 */
export class MailChannelsWorkerProvider extends MailChannelsProviderBase {
  private readonly workerId: string;
  
  /**
   * Create a new MailChannelsWorkerProvider
   * @param workerId The Cloudflare Worker ID for domain lockdown authentication
   */
  constructor(workerId: string = "email.saraengland.com") {
    super();
    this.workerId = workerId;
  }
  
  /**
   * No specific validation for Worker authentication
   */
  protected validateAuthentication(): void {
    // No validation needed for Worker authentication
  }
  
  /**
   * Add Worker ID to the payload headers
   * @param payload The MailChannels payload to modify
   */
  protected modifyPayload(payload: MailChannelsPayload): void {
    // Ensure headers object exists
    if (!payload.headers) {
      payload.headers = {};
    }
    
    // Add Worker ID header
    payload.headers["X-Mailchannels-Worker-ID"] = this.workerId;
  }
  
  /**
   * No special headers for Worker authentication
   * @returns Empty headers object
   */
  protected getRequestHeaders(): Record<string, string> {
    return {};
  }
}

/**
 * Main MailChannels provider implementation
 * Uses API key authentication when available, falls back to Worker authentication
 */
export class MailchannelsProvider implements EmailProvider {
  private provider: EmailProvider;
  
  constructor() {
    // Determine which authentication method to use
    if (env.MAILCHANNELS_API_KEY) {
      log.info('Using MailChannels API key authentication');
      this.provider = new MailChannelsApiKeyProvider();
    } else {
      log.info('Using MailChannels Worker authentication');
      this.provider = new MailChannelsWorkerProvider();
    }
  }
  
  /**
   * Send an email using the appropriate MailChannels authentication method
   * @param data Email request data
   * @param ipAddress IP address for logging
   * @returns Email send result
   */
  async sendEmail(data: EmailRequest, ipAddress?: string): Promise<EmailSendResult> {
    return this.provider.sendEmail(data, ipAddress);
  }
} 