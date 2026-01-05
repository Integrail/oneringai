/**
 * Base provider class with common functionality
 */

import { IProvider, ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import { ProviderConfig } from '../../../domain/types/ProviderConfig.js';

export abstract class BaseProvider implements IProvider {
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapabilities;

  constructor(protected config: ProviderConfig) {}

  /**
   * Validate provider configuration
   */
  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }
    return true;
  }

  /**
   * Get API key from config
   */
  protected getApiKey(): string {
    return this.config.apiKey;
  }

  /**
   * Get base URL if configured
   */
  protected getBaseURL(): string | undefined {
    return this.config.baseURL;
  }

  /**
   * Get timeout configuration
   */
  protected getTimeout(): number {
    return this.config.timeout || 60000; // 60s default
  }

  /**
   * Get max retries configuration
   */
  protected getMaxRetries(): number {
    return this.config.maxRetries || 3;
  }
}
