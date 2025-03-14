import { EmailRequest } from '@schema/api';

/**
 * Result of sending an email
 */
export interface EmailSendResult {
  /**
   * Whether the email was sent successfully
   */
  success: boolean;
  
  /**
   * Unique identifier for the sent email, if available
   * Can be null if the provider doesn't return an ID or the message failed to send
   */
  messageId: string | null;
  
  /**
   * Error information if the email failed to send
   * Should be null for successful sends
   */
  error: Error | null;
}

/**
 * Interface for all email providers
 * This provides a common interface for different email sending mechanisms
 */
export interface EmailProvider {
  /**
   * Initialize the email provider
   * This should be called before the provider is used
   * It may establish connections, authenticate, or perform other setup
   * @returns A promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;
  
  /**
   * Send an email with the given data
   * @param data The request data for the email
   * @param ipAddress The IP address of the requester (for rate limiting/tracing)
   * @param isWorkerEnvironment Whether we're in a Cloudflare Worker environment
   * @returns A promise that resolves with the result of sending the email
   */
  sendEmail(
    data: EmailRequest,
    ipAddress?: string,
    isWorkerEnvironment?: boolean
  ): Promise<EmailSendResult>;
} 