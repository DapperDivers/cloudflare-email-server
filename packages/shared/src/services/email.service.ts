import { EmailRequestSchema, type EmailRequest } from '@shared-schema/api';
import { EmailProviderFactory } from '@shared-services/email-providers/email-provider-factory';
import { EmailError } from '@shared-utils/errors';
import { logger } from '@shared-utils/logger';

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
  duration?: number;
}

/**
 * Service for sending emails using configurable providers
 * This service acts as a facade to the email provider implementations
 * It doesn't maintain state and delegates to the provider factory for initialization and caching
 */
export class EmailService {
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

      // Get the appropriate provider for this environment
      // The factory handles caching and initialization
      const provider = await EmailProviderFactory.getProvider(isWorkerEnvironment);

      // Send the email using the provider
      const result = await provider.sendEmail(validatedData, ipAddress, isWorkerEnvironment);

      const duration = Date.now() - startTime;

      if (result.success) {
        logger.info('Email sent successfully', {
          recipientEmail: validatedData.email,
          duration,
          isWorkerEnvironment,
        });

        return {
          success: true,
          messageId: result.messageId || undefined,
          message: 'Email sent successfully',
          duration,
        };
      } else {
        // If the provider returned an error but didn't throw
        throw result.error || new Error('Unknown error during email sending');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInstance = error instanceof Error ? error : new Error('Unknown error occurred');

      logger.error('Email sending failed', errorInstance, {
        ip: ipAddress,
        duration,
        isWorkerEnvironment,
      });

      if (error instanceof EmailError) {
        throw error;
      }

      throw new EmailError(errorInstance.message);
    }
  }
}
