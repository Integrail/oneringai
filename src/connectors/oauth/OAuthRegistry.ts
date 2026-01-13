/**
 * OAuth Provider Registry - Global singleton for managing OAuth providers
 * Register providers once, use everywhere with authenticated fetch and tools
 */

import { OAuthManager } from './OAuthManager.js';
import type { OAuthConfig } from './types.js';

export interface RegisteredProvider {
  name: string; // Unique ID: 'microsoft', 'google', 'github', etc.
  displayName: string; // Human-readable: 'Microsoft Graph API'
  description: string; // What APIs it provides access to
  baseURL: string; // Base URL for the API
  oauthManager: OAuthManager; // OAuth manager instance
}

export interface ProviderRegistrationConfig {
  displayName: string;
  description: string;
  baseURL: string;
  oauth: OAuthConfig | OAuthManager;
}

export class OAuthRegistry {
  private static instance: OAuthRegistry;
  private providers: Map<string, RegisteredProvider> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OAuthRegistry {
    if (!OAuthRegistry.instance) {
      OAuthRegistry.instance = new OAuthRegistry();
    }
    return OAuthRegistry.instance;
  }

  /**
   * Register an OAuth provider
   *
   * @param name - Unique provider identifier (e.g., 'microsoft', 'google')
   * @param config - Provider configuration
   */
  register(name: string, config: ProviderRegistrationConfig): void {
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error('Provider name cannot be empty');
    }

    if (this.providers.has(name)) {
      console.warn(`OAuth provider '${name}' is already registered. Overwriting...`);
    }

    // Create OAuthManager if config provided, or use existing instance
    const oauthManager =
      config.oauth instanceof OAuthManager ? config.oauth : new OAuthManager(config.oauth);

    this.providers.set(name, {
      name,
      displayName: config.displayName,
      description: config.description,
      baseURL: config.baseURL,
      oauthManager,
    });
  }

  /**
   * Get provider by name
   *
   * @throws Error if provider not found
   */
  get(name: string): RegisteredProvider {
    const provider = this.providers.get(name);

    if (!provider) {
      const available = this.listProviderNames();
      const availableList = available.length > 0 ? available.join(', ') : 'none';

      throw new Error(
        `OAuth provider '${name}' not found. Available providers: ${availableList}`
      );
    }

    return provider;
  }

  /**
   * Check if provider exists
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Get all registered provider names
   */
  listProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all registered providers with full metadata
   */
  listProviders(): RegisteredProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider descriptions formatted for tool parameters
   * Returns a string suitable for including in tool descriptions
   */
  getProviderDescriptionsForTools(): string {
    const providers = this.listProviders();

    if (providers.length === 0) {
      return 'No OAuth providers registered yet.';
    }

    return providers
      .map((p) => `  - "${p.name}": ${p.displayName} - ${p.description}`)
      .join('\n');
  }

  /**
   * Get provider names and descriptions as an object (for documentation)
   */
  getProviderInfo(): Record<string, { displayName: string; description: string; baseURL: string }> {
    const info: Record<string, any> = {};

    for (const [name, provider] of this.providers) {
      info[name] = {
        displayName: provider.displayName,
        description: provider.description,
        baseURL: provider.baseURL,
      };
    }

    return info;
  }

  /**
   * Unregister a provider
   */
  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Clear all providers (useful for testing)
   */
  clear(): void {
    this.providers.clear();
  }

  /**
   * Get number of registered providers
   */
  size(): number {
    return this.providers.size;
  }
}

/**
 * Singleton instance - use this in your code
 */
export const oauthRegistry = OAuthRegistry.getInstance();
