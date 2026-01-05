/**
 * Main client class - entry point for the library
 */

import { ProvidersConfig } from '../domain/types/ProviderConfig.js';
import { LogLevel } from '../domain/types/CommonTypes.js';
import { ProviderRegistry } from './ProviderRegistry.js';
import { AgentManager } from '../capabilities/agents/AgentManager.js';
import { TextManager } from '../capabilities/text/TextManager.js';
import { ImageManager } from '../capabilities/images/ImageManager.js';
import { ProviderCapabilities } from '../domain/interfaces/IProvider.js';
import { ProviderNotFoundError } from '../domain/errors/AIErrors.js';

export interface OneRingAIConfig {
  providers: ProvidersConfig;
  defaultProvider?: string;
  logLevel?: LogLevel;
}

export class OneRingAI {
  private registry: ProviderRegistry;

  // Capability managers (lazy loaded)
  private _agents?: AgentManager;
  private _text?: TextManager;
  private _images?: ImageManager;

  constructor(config: OneRingAIConfig) {
    this.registry = new ProviderRegistry(config.providers);
  }

  /**
   * Access agent capability (with tool calling)
   */
  get agents(): AgentManager {
    if (!this._agents) {
      this._agents = new AgentManager(this.registry);
    }
    return this._agents;
  }

  /**
   * Access simple text generation capability
   */
  get text(): TextManager {
    if (!this._text) {
      this._text = new TextManager(this.registry);
    }
    return this._text;
  }

  /**
   * Access image generation capability
   */
  get images(): ImageManager {
    if (!this._images) {
      this._images = new ImageManager(this.registry);
    }
    return this._images;
  }

  /**
   * List all configured providers
   */
  listProviders(): string[] {
    return this.registry.listProviders();
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(providerName: string): ProviderCapabilities {
    if (!this.registry.hasProvider(providerName)) {
      throw new ProviderNotFoundError(providerName);
    }

    // Try to get text provider to check capabilities
    try {
      const provider = this.registry.getTextProvider(providerName);
      return provider.capabilities;
    } catch {
      // If text provider fails, try image provider
      try {
        const provider = this.registry.getImageProvider(providerName);
        return provider.capabilities;
      } catch {
        throw new ProviderNotFoundError(providerName);
      }
    }
  }

  /**
   * Check if a provider is configured
   */
  hasProvider(providerName: string): boolean {
    return this.registry.hasProvider(providerName);
  }
}
