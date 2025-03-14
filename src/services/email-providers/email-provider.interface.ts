import { EmailRequest } from '../../schema/api.js';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
  duration?: number;
}

/**
 * Interface for all email providers to implement
 */
export interface EmailProvider {
  /**
   * Send an email using the provider's implementation
   * @param data The email request data
   * @param ipAddress Optional IP address for logging
   * @returns Result of the email sending operation
   */
  sendEmail(data: EmailRequest, ipAddress?: string): Promise<EmailSendResult>;
  
  /**
   * Initialize the email provider (if needed)
   */
  initialize?(): Promise<void>;
  
  /**
   * Clean up resources when done (if needed)
   */
  close?(): Promise<void>;
} 