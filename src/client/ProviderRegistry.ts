/**
 * Provider registry - manages provider configurations and instances
 */

import { ITextProvider } from '../domain/interfaces/ITextProvider.js';
import { IImageProvider } from '../domain/interfaces/IImageProvider.js';
import { ProviderConfig, ProvidersConfig, OpenAIConfig } from '../domain/types/ProviderConfig.js';
import { ProviderNotFoundError, InvalidConfigError } from '../domain/errors/AIErrors.js';
import { OpenAITextProvider } from '../infrastructure/providers/openai/OpenAITextProvider.js';

export class ProviderRegistry {
  private configs: Map<string, ProviderConfig> = new Map();
  private textProviders: Map<string, ITextProvider> = new Map();
  private imageProviders: Map<string, IImageProvider> = new Map();

  constructor(providersConfig: ProvidersConfig) {
    // Store configurations
    for (const [name, config] of Object.entries(providersConfig)) {
      if (config) {
        this.registerConfig(name, config);
      }
    }
  }

  /**
   * Register a provider configuration
   */
  private registerConfig(name: string, config: ProviderConfig): void {
    if (!config.apiKey) {
      throw new InvalidConfigError(`Provider '${name}' requires an apiKey`);
    }
    this.configs.set(name, config);
  }

  /**
   * Get a text provider instance (lazy loaded and cached)
   */
  getTextProvider(name: string): ITextProvider {
    // Check if already instantiated
    if (this.textProviders.has(name)) {
      return this.textProviders.get(name)!;
    }

    // Check if config exists
    const config = this.configs.get(name);
    if (!config) {
      throw new ProviderNotFoundError(name);
    }

    // Lazy load provider
    const provider = this.createTextProvider(name, config);
    this.textProviders.set(name, provider);
    return provider;
  }

  /**
   * Get an image provider instance (lazy loaded and cached)
   */
  getImageProvider(name: string): IImageProvider {
    // Check if already instantiated
    if (this.imageProviders.has(name)) {
      return this.imageProviders.get(name)!;
    }

    // Check if config exists
    const config = this.configs.get(name);
    if (!config) {
      throw new ProviderNotFoundError(name);
    }

    // Lazy load provider
    const provider = this.createImageProvider(name, config);
    this.imageProviders.set(name, provider);
    return provider;
  }

  /**
   * Factory method to create text provider
   */
  private createTextProvider(name: string, config: ProviderConfig): ITextProvider {
    switch (name) {
      case 'openai':
        return new OpenAITextProvider(config as OpenAIConfig);
      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented');
      case 'google':
        throw new Error('Google provider not yet implemented');
      default:
        throw new ProviderNotFoundError(name);
    }
  }

  /**
   * Factory method to create image provider
   */
  private createImageProvider(name: string, _config: ProviderConfig): IImageProvider {
    switch (name) {
      case 'openai':
        throw new Error('OpenAI image provider not yet implemented');
      case 'google':
        throw new Error('Google image provider not yet implemented');
      default:
        throw new ProviderNotFoundError(name);
    }
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(name: string): boolean {
    return this.configs.has(name);
  }

  /**
   * List all registered provider names
   */
  listProviders(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Get provider configuration
   */
  getConfig(name: string): ProviderConfig | undefined {
    return this.configs.get(name);
  }
}
