import { env } from '@config/env';
import { EmailProvider } from '@services/email-providers/email-provider.interface';
import { MailchannelsProvider, MailChannelsWorkerProvider } from '@services/email-providers/mailchannels-provider';
import { NodemailerProvider } from '@services/email-providers/nodemailer-provider';
import { logger } from '@utils/logger';

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
    const providerType = env.EMAIL_SERVICE || 'nodemailer';
    const cacheKey = `${providerType}-${useWorker ? 'worker' : 'standard'}`;
    
    // Return cached provider if available
    if (this.providerCache.has(cacheKey)) {
      logger.info(`Using cached ${cacheKey} email provider`);
      const cachedProvider = this.providerCache.get(cacheKey);
      if (cachedProvider) {
        return cachedProvider;
      }
    }
    
    logger.info(`Creating new ${cacheKey} email provider`);
    
    // Create appropriate provider based on configuration
    let provider: EmailProvider;
    
    switch (providerType.toLowerCase()) {
      case 'mailchannels':
        provider = useWorker 
          ? new MailChannelsWorkerProvider()
          : new MailchannelsProvider();
        break;
      
      case 'nodemailer':
      default:
        if (useWorker) {
          logger.warn('NodemailerProvider not designed for Workers. Using MailChannelsWorkerProvider instead.');
          provider = new MailChannelsWorkerProvider();
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
      logger.error('Failed to initialize email provider', error instanceof Error ? error : new Error('Unknown error'));
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