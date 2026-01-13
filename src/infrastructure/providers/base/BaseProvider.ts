/**
 * Base provider class with common functionality
 */

import { IProvider, ProviderCapabilities } from '../../../domain/interfaces/IProvider.js';
import { ProviderConfig } from '../../../domain/types/ProviderConfig.js';
import { InvalidConfigError } from '../../../domain/errors/AIErrors.js';

export abstract class BaseProvider implements IProvider {
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapabilities;

  constructor(protected config: ProviderConfig) {}

  /**
   * Validate provider configuration
   * Returns validation result with details
   */
  async validateConfig(): Promise<boolean> {
    const validation = this.validateApiKey();
    return validation.isValid;
  }

  /**
   * Validate API key format and presence
   * Can be overridden by providers with specific key formats
   */
  protected validateApiKey(): { isValid: boolean; warning?: string } {
    const apiKey = this.config.apiKey;

    // Check for presence
    if (!apiKey || apiKey.trim().length === 0) {
      return { isValid: false };
    }

    // Check for common placeholder values
    const placeholders = [
      'your-api-key',
      'YOUR_API_KEY',
      'sk-xxx',
      'api-key-here',
      'REPLACE_ME',
      '<your-key>',
    ];

    if (placeholders.some((p) => apiKey.includes(p))) {
      return {
        isValid: false,
        warning: `API key appears to be a placeholder value`,
      };
    }

    // Provider-specific format validation (can be overridden)
    return this.validateProviderSpecificKeyFormat(apiKey);
  }

  /**
   * Override this method in provider implementations for specific key format validation
   */
  protected validateProviderSpecificKeyFormat(_apiKey: string): { isValid: boolean; warning?: string } {
    // Default: accept any non-empty key
    // Override in subclasses for provider-specific validation
    return { isValid: true };
  }

  /**
   * Validate config and throw if invalid
   */
  protected assertValidConfig(): void {
    const validation = this.validateApiKey();
    if (!validation.isValid) {
      throw new InvalidConfigError(
        `Invalid API key for provider '${this.name}'${validation.warning ? `: ${validation.warning}` : ''}`
      );
    }
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
