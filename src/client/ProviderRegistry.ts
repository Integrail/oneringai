/**
 * Provider registry - manages provider configurations and instances
 */

import { ITextProvider } from '../domain/interfaces/ITextProvider.js';
import { IImageProvider } from '../domain/interfaces/IImageProvider.js';
import {
  ProviderConfig,
  ProvidersConfig,
  OpenAIConfig,
  AnthropicConfig,
  GoogleConfig,
  GenericOpenAIConfig,
} from '../domain/types/ProviderConfig.js';
import { ProviderNotFoundError, InvalidConfigError } from '../domain/errors/AIErrors.js';
import { OpenAITextProvider } from '../infrastructure/providers/openai/OpenAITextProvider.js';
import { GenericOpenAIProvider } from '../infrastructure/providers/generic/GenericOpenAIProvider.js';
import { AnthropicTextProvider } from '../infrastructure/providers/anthropic/AnthropicTextProvider.js';
import { GoogleTextProvider } from '../infrastructure/providers/google/GoogleTextProvider.js';

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
        return new AnthropicTextProvider(config as AnthropicConfig);

      case 'google':
      case 'gemini':
        return new GoogleTextProvider(config as GoogleConfig);

      case 'grok':
        // xAI Grok - OpenAI-compatible
        return new GenericOpenAIProvider(
          'grok',
          {
            ...config,
            baseURL: (config as any).baseURL || 'https://api.x.ai/v1',
          } as GenericOpenAIConfig,
          { text: true, images: true, videos: false, audio: false }
        );

      case 'groq':
        // Groq - OpenAI-compatible (for Llama, Mixtral, etc.)
        return new GenericOpenAIProvider(
          'groq',
          {
            ...config,
            baseURL: (config as any).baseURL || 'https://api.groq.com/openai/v1',
          } as GenericOpenAIConfig,
          { text: true, images: false, videos: false, audio: false }
        );

      case 'together-ai':
      case 'together':
        // Together AI - OpenAI-compatible (for Llama, etc.)
        return new GenericOpenAIProvider(
          'together-ai',
          {
            ...config,
            baseURL: (config as any).baseURL || 'https://api.together.xyz/v1',
          } as GenericOpenAIConfig,
          { text: true, images: true, videos: false, audio: false }
        );

      case 'perplexity':
        // Perplexity - OpenAI-compatible
        return new GenericOpenAIProvider(
          'perplexity',
          {
            ...config,
            baseURL: (config as any).baseURL || 'https://api.perplexity.ai',
          } as GenericOpenAIConfig,
          { text: true, images: false, videos: false, audio: false }
        );

      default:
        // Try as generic OpenAI-compatible provider if baseURL is provided
        if ('baseURL' in config && config.baseURL) {
          return new GenericOpenAIProvider(name, config as GenericOpenAIConfig);
        }
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
