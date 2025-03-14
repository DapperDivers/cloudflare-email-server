import { env } from '@shared-config/env';
import { EmailProvider } from '@shared-services/email-providers/email-provider.interface';
import {
  MailchannelsProvider,
  MailChannelsWorkerProvider,
  MailChannelsApiKeyProvider,
} from '@shared-services/email-providers/mailchannels-provider';
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
   * @param useWorker Whether to use Worker-specific providers if available
   * @returns An initialized EmailProvider instance
   */
  public static async getProvider(useWorker: boolean = false): Promise<EmailProvider> {
    // Prioritize EMAIL_PROVIDER over EMAIL_SERVICE
    const emailProvider = env.EMAIL_PROVIDER;
    const emailService = env.EMAIL_SERVICE || 'gmail';

    // Determine provider type based on EMAIL_PROVIDER or fallback to EMAIL_SERVICE
    const providerType = emailProvider === 'mailchannels' ? 'mailchannels' : emailService;

    const cacheKey = `${providerType}-${useWorker ? 'worker' : 'standard'}`;

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
      useWorker,
    });

    // Create appropriate provider based on configuration
    let provider: EmailProvider;

    switch (providerType.toLowerCase()) {
      case 'mailchannels':
        // Always use API Key provider when MAILCHANNELS_API_KEY is available
        if (env.MAILCHANNELS_API_KEY) {
          logger.info('Using MailChannels API Key authentication', {
            hasApiKey: Boolean(env.MAILCHANNELS_API_KEY),
            apiKeyLength: env.MAILCHANNELS_API_KEY.length,
          });
          provider = new MailChannelsApiKeyProvider(String(env.MAILCHANNELS_API_KEY));
        } else if (useWorker) {
          logger.info('No API key found, falling back to Worker authentication');
          provider = new MailChannelsWorkerProvider();
        } else {
          provider = new MailchannelsProvider();
        }
        break;

      case 'nodemailer':
      default:
        if (useWorker) {
          // For Workers, use MailChannels with API key if available
          if (env.MAILCHANNELS_API_KEY) {
            logger.warn(
              'NodemailerProvider not designed for Workers. Using MailChannelsApiKeyProvider instead.'
            );
            logger.info('API Key details for NodemailerProvider fallback', {
              hasApiKey: Boolean(env.MAILCHANNELS_API_KEY),
              apiKeyLength: env.MAILCHANNELS_API_KEY.length,
            });
            provider = new MailChannelsApiKeyProvider(String(env.MAILCHANNELS_API_KEY));
          } else {
            logger.warn(
              'NodemailerProvider not designed for Workers. Using MailChannelsWorkerProvider instead.'
            );
            provider = new MailChannelsWorkerProvider();
          }
        } else {
          provider = new NodemailerProvider();
        }
        break;
    }

    // Initialize the provider
    try {
      await provider.initialize();

      // Cache the initialized provider
      this.providerCache.set(cacheKey, provider);

      return provider;
    } catch (error) {
      logger.error(
        'Failed to initialize email provider',
        error instanceof Error ? error : new Error('Unknown error')
      );
      throw error;
    }
  }

  /**
   * Clear the provider cache
   * Useful for testing or when reconfiguration is needed
   */
  public static clearCache(): void {
    this.providerCache.clear();
  }
}
