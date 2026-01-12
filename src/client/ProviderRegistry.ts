/**
 * Provider registry - manages provider configurations and instances
 *
 * Implements IDisposable for proper resource cleanup and uses
 * promise-based locking to prevent race conditions during lazy loading.
 */

import { ITextProvider } from '../domain/interfaces/ITextProvider.js';
import { IImageProvider } from '../domain/interfaces/IImageProvider.js';
import { IDisposable, assertNotDestroyed } from '../domain/interfaces/IDisposable.js';
import {
  ProviderConfig,
  ProvidersConfig,
  OpenAIConfig,
  AnthropicConfig,
  GoogleConfig,
  VertexAIConfig,
  GenericOpenAIConfig,
} from '../domain/types/ProviderConfig.js';
import { ProviderNotFoundError, InvalidConfigError } from '../domain/errors/AIErrors.js';
import { OpenAITextProvider } from '../infrastructure/providers/openai/OpenAITextProvider.js';
import { GenericOpenAIProvider } from '../infrastructure/providers/generic/GenericOpenAIProvider.js';
import { AnthropicTextProvider } from '../infrastructure/providers/anthropic/AnthropicTextProvider.js';
import { GoogleTextProvider } from '../infrastructure/providers/google/GoogleTextProvider.js';
import { VertexAITextProvider } from '../infrastructure/providers/vertex/VertexAITextProvider.js';

export class ProviderRegistry implements IDisposable {
  private configs: Map<string, ProviderConfig> = new Map();
  private textProviders: Map<string, ITextProvider> = new Map();
  private imageProviders: Map<string, IImageProvider> = new Map();

  // Promise locks for preventing race conditions during lazy loading
  private textProviderPromises: Map<string, Promise<ITextProvider>> = new Map();
  private imageProviderPromises: Map<string, Promise<IImageProvider>> = new Map();

  private _isDestroyed = false;

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

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
    // Enhanced API key validation
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new InvalidConfigError(`Provider '${name}' requires a non-empty apiKey`);
    }

    // Provider-specific format hints (warnings only, don't block)
    if (name === 'openai' && !config.apiKey.startsWith('sk-')) {
      console.warn(`[ProviderRegistry] OpenAI API key should typically start with 'sk-'`);
    }
    if (name === 'anthropic' && !config.apiKey.startsWith('sk-ant-')) {
      console.warn(`[ProviderRegistry] Anthropic API key should typically start with 'sk-ant-'`);
    }

    this.configs.set(name, config);
  }

  /**
   * Get a text provider instance (lazy loaded and cached)
   * Uses promise-based locking to prevent race conditions
   */
  async getTextProvider(name: string): Promise<ITextProvider> {
    assertNotDestroyed(this, 'get text provider');

    // Check if already instantiated
    if (this.textProviders.has(name)) {
      return this.textProviders.get(name)!;
    }

    // Check if creation is already in progress (race condition prevention)
    const existingPromise = this.textProviderPromises.get(name);
    if (existingPromise) {
      return existingPromise;
    }

    // Check if config exists
    const config = this.configs.get(name);
    if (!config) {
      throw new ProviderNotFoundError(name);
    }

    // Create with promise locking
    const createPromise = this.createTextProviderAsync(name, config);
    this.textProviderPromises.set(name, createPromise);

    try {
      const provider = await createPromise;
      this.textProviders.set(name, provider);
      return provider;
    } finally {
      // Always clean up the promise lock
      this.textProviderPromises.delete(name);
    }
  }

  /**
   * Get a text provider instance synchronously (for backward compatibility)
   * WARNING: This method may create duplicate providers under concurrent access.
   * Prefer getTextProvider() (async) for new code.
   * @deprecated Use async getTextProvider() instead to prevent race conditions
   */
  getTextProviderSync(name: string): ITextProvider {
    assertNotDestroyed(this, 'get text provider');

    // Check if already instantiated
    if (this.textProviders.has(name)) {
      return this.textProviders.get(name)!;
    }

    // Check if config exists
    const config = this.configs.get(name);
    if (!config) {
      throw new ProviderNotFoundError(name);
    }

    // Lazy load provider (may race with concurrent calls)
    const provider = this.createTextProvider(name, config);
    this.textProviders.set(name, provider);
    return provider;
  }

  /**
   * Get an image provider instance (lazy loaded and cached)
   * Uses promise-based locking to prevent race conditions
   */
  async getImageProvider(name: string): Promise<IImageProvider> {
    assertNotDestroyed(this, 'get image provider');

    // Check if already instantiated
    if (this.imageProviders.has(name)) {
      return this.imageProviders.get(name)!;
    }

    // Check if creation is already in progress (race condition prevention)
    const existingPromise = this.imageProviderPromises.get(name);
    if (existingPromise) {
      return existingPromise;
    }

    // Check if config exists
    const config = this.configs.get(name);
    if (!config) {
      throw new ProviderNotFoundError(name);
    }

    // Create with promise locking
    const createPromise = this.createImageProviderAsync(name, config);
    this.imageProviderPromises.set(name, createPromise);

    try {
      const provider = await createPromise;
      this.imageProviders.set(name, provider);
      return provider;
    } finally {
      // Always clean up the promise lock
      this.imageProviderPromises.delete(name);
    }
  }

  /**
   * Async wrapper for text provider creation
   */
  private async createTextProviderAsync(
    name: string,
    config: ProviderConfig
  ): Promise<ITextProvider> {
    // Provider creation is synchronous, but wrapped in async for future extensibility
    // and to support the promise-based locking pattern
    return this.createTextProvider(name, config);
  }

  /**
   * Async wrapper for image provider creation
   */
  private async createImageProviderAsync(
    name: string,
    config: ProviderConfig
  ): Promise<IImageProvider> {
    return this.createImageProvider(name, config);
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

      case 'vertex-ai':
      case 'google-vertex':
        return new VertexAITextProvider(config as VertexAIConfig);

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

  /**
   * Destroy the registry and release all resources
   * Safe to call multiple times (idempotent)
   */
  destroy(): void {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;

    // Clear all cached providers
    this.textProviders.clear();
    this.imageProviders.clear();

    // Clear pending promises (they will resolve but result won't be cached)
    this.textProviderPromises.clear();
    this.imageProviderPromises.clear();

    // Clear configs
    this.configs.clear();
  }
}
