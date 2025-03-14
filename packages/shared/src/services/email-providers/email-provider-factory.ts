import { env } from '@shared-config/env';
import { EmailProvider } from '@shared-services/email-providers/email-provider.interface';
import { MailChannelsProvider } from '@shared-services/email-providers/mailchannels-provider';
import { NodemailerProvider } from '@shared-services/email-providers/nodemailer-provider';
import { logger } from '@shared-utils/logger';

/**
 * Factory class responsible for creating and caching email provider instances
 */
export class EmailProviderFactory {
  // Cache of initialized providers
  private static providerCache: Map<string, EmailProvider> = new Map();

  /**
   * Get an initialized email provider based on the configured environment
   * This method will create and initialize the provider if it doesn't exist yet
   * @returns An initialized EmailProvider instance
   */
  public static async getProvider(): Promise<EmailProvider> {
    // Prioritize EMAIL_PROVIDER over EMAIL_SERVICE
    const emailProvider = env.EMAIL_PROVIDER;
    const emailService = env.EMAIL_SERVICE || 'gmail';

    // Determine provider type based on EMAIL_PROVIDER or fallback to EMAIL_SERVICE
    const providerType = emailProvider === 'mailchannels' ? 'mailchannels' : emailService;

    const cacheKey = providerType;

    // Return cached provider if available
    if (this.providerCache.has(cacheKey)) {
      logger.info(`Using cached ${cacheKey} email provider`);
      const cachedProvider = this.providerCache.get(cacheKey);
      if (cachedProvider) {
        return cachedProvider;
      }
    }

    logger.info(`Creating new ${cacheKey} email provider`, {
      emailProvider,
      emailService,
      providerType,
    });

    // Create appropriate provider based on configuration
    let provider: EmailProvider;

    switch (providerType.toLowerCase()) {
      case 'mailchannels':
        if (!env.MAILCHANNELS_API_KEY) {
          throw new Error('MAILCHANNELS_API_KEY is required for MailChannels provider');
        }
        provider = new MailChannelsProvider(env.MAILCHANNELS_API_KEY);
        break;

      case 'nodemailer':
      default:
        provider = new NodemailerProvider();
        break;
    }

    // Initialize the provider
    await provider.initialize();

    // Cache the provider
    this.providerCache.set(cacheKey, provider);

    return provider;
  }

  /**
   * Clear the provider cache
   * Useful for testing or when reconfiguration is needed
   */
  public static clearCache(): void {
    this.providerCache.clear();
  }
}
