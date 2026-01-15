/**
 * Connector - The single source of truth for authentication
 *
 * Manages authenticated connections to:
 * - AI providers (OpenAI, Anthropic, Google, etc.)
 * - External APIs (GitHub, Salesforce, etc.)
 */

import { ConnectorConfig, ConnectorAuth } from '../domain/entities/Connector.js';
import { Vendor } from './Vendor.js';
import { OAuthManager } from '../connectors/oauth/OAuthManager.js';
import { MemoryStorage } from '../connectors/oauth/infrastructure/storage/MemoryStorage.js';
import type { ITokenStorage } from '../connectors/oauth/domain/ITokenStorage.js';

/**
 * Connector class - represents a single authenticated connection
 */
export class Connector {
  // ============ Static Registry ============

  private static registry: Map<string, Connector> = new Map();
  private static defaultStorage: ITokenStorage = new MemoryStorage();

  /**
   * Create and register a new connector
   * @param config - Must include `name` field
   */
  static create(config: ConnectorConfig & { name: string }): Connector {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Connector name is required');
    }
    if (Connector.registry.has(config.name)) {
      throw new Error(`Connector '${config.name}' already exists. Use Connector.get() or choose a different name.`);
    }
    const connector = new Connector(config);
    Connector.registry.set(config.name, connector);
    return connector;
  }

  /**
   * Get a connector by name
   */
  static get(name: string): Connector {
    const connector = Connector.registry.get(name);
    if (!connector) {
      const available = Connector.list().join(', ') || 'none';
      throw new Error(`Connector '${name}' not found. Available: ${available}`);
    }
    return connector;
  }

  /**
   * Check if a connector exists
   */
  static has(name: string): boolean {
    return Connector.registry.has(name);
  }

  /**
   * List all registered connector names
   */
  static list(): string[] {
    return Array.from(Connector.registry.keys());
  }

  /**
   * Remove a connector
   */
  static remove(name: string): boolean {
    const connector = Connector.registry.get(name);
    if (connector) {
      connector.dispose();
    }
    return Connector.registry.delete(name);
  }

  /**
   * Clear all connectors (useful for testing)
   */
  static clear(): void {
    for (const connector of Connector.registry.values()) {
      connector.dispose();
    }
    Connector.registry.clear();
  }

  /**
   * Set default token storage for OAuth connectors
   */
  static setDefaultStorage(storage: ITokenStorage): void {
    Connector.defaultStorage = storage;
  }

  // ============ Instance ============

  readonly name: string;
  readonly vendor?: Vendor;
  readonly config: ConnectorConfig;

  private oauthManager?: OAuthManager;
  private disposed = false;

  private constructor(config: ConnectorConfig & { name: string }) {
    this.name = config.name;
    this.vendor = config.vendor;
    this.config = config;

    // Initialize OAuth manager if needed
    if (config.auth.type === 'oauth') {
      this.initOAuthManager(config.auth);
    }
  }

  /**
   * Get the API key (for api_key auth type)
   */
  getApiKey(): string {
    if (this.config.auth.type !== 'api_key') {
      throw new Error(`Connector '${this.name}' does not use API key auth. Type: ${this.config.auth.type}`);
    }
    return this.config.auth.apiKey;
  }

  /**
   * Get the current access token (for OAuth)
   * Handles automatic refresh if needed
   */
  async getToken(userId?: string): Promise<string> {
    if (this.config.auth.type === 'api_key') {
      return this.config.auth.apiKey;
    }

    if (this.config.auth.type === 'jwt') {
      // JWT auth - token is generated on demand
      throw new Error('JWT auth getToken() not yet implemented');
    }

    if (!this.oauthManager) {
      throw new Error(`OAuth manager not initialized for connector '${this.name}'`);
    }

    return this.oauthManager.getToken(userId);
  }

  /**
   * Start OAuth authorization flow
   * Returns the URL to redirect the user to
   */
  async startAuth(userId?: string): Promise<string> {
    if (!this.oauthManager) {
      throw new Error(`Connector '${this.name}' is not an OAuth connector`);
    }
    return this.oauthManager.startAuthFlow(userId);
  }

  /**
   * Handle OAuth callback
   * Call this after user is redirected back from OAuth provider
   */
  async handleCallback(callbackUrl: string, userId?: string): Promise<void> {
    if (!this.oauthManager) {
      throw new Error(`Connector '${this.name}' is not an OAuth connector`);
    }
    await this.oauthManager.handleCallback(callbackUrl, userId);
  }

  /**
   * Check if the connector has a valid token
   */
  async hasValidToken(userId?: string): Promise<boolean> {
    try {
      if (this.config.auth.type === 'api_key') {
        return true; // API keys are always "valid" (we don't validate them)
      }
      if (this.oauthManager) {
        const token = await this.oauthManager.getToken(userId);
        return !!token;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get vendor-specific options from config
   */
  getOptions(): Record<string, unknown> {
    return this.config.options ?? {};
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // OAuthManager doesn't need explicit disposal
    this.oauthManager = undefined;
  }

  // ============ Private ============

  private initOAuthManager(auth: ConnectorAuth & { type: 'oauth' }): void {
    // Convert ConnectorAuth to OAuthConfig
    const oauthConfig = {
      flow: auth.flow as 'authorization_code' | 'client_credentials' | 'jwt_bearer',
      clientId: auth.clientId,
      clientSecret: auth.clientSecret,
      tokenUrl: auth.tokenUrl,
      authorizationUrl: auth.authorizationUrl,
      redirectUri: auth.redirectUri,
      scope: auth.scope,
      usePKCE: auth.usePKCE,
      privateKey: auth.privateKey,
      privateKeyPath: auth.privateKeyPath,
      refreshBeforeExpiry: auth.refreshBeforeExpiry,
      storage: Connector.defaultStorage,
      storageKey: auth.storageKey ?? this.name,
    };

    this.oauthManager = new OAuthManager(oauthConfig);
  }
}
