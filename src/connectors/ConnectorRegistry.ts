/**
 * Connector Registry - Global singleton for managing external system connectors
 *
 * Connectors provide authenticated access to external APIs (GitHub, Microsoft, Salesforce, etc.)
 * This is DIFFERENT from Providers (OpenAI, Anthropic) which provide AI capabilities.
 *
 * Register connectors once, use everywhere with authenticatedFetch and tools
 */

import { OAuthManager } from './oauth/OAuthManager.js';
import type { OAuthConfig } from './oauth/types.js';
import { ConnectorConfig, ConnectorAuth } from '../domain/entities/Connector.js';
import { IConnector } from '../domain/interfaces/IConnector.js';
import { OAuthConnector } from './oauth/OAuthConnector.js';

/**
 * Legacy registration config (for backward compatibility during migration)
 */
export interface LegacyProviderRegistrationConfig {
  displayName: string;
  description: string;
  baseURL: string;
  oauth: OAuthConfig | OAuthManager;
}

/**
 * Connector registration - simplified interface
 * Just pass ConnectorConfig!
 */
export type ConnectorRegistrationConfig = ConnectorConfig | LegacyProviderRegistrationConfig;

/**
 * Connector Registry - manages all external system connectors
 */
export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors: Map<string, IConnector> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  /**
   * Register a connector for external system access
   *
   * @param name - Unique connector identifier (e.g., 'microsoft', 'google', 'github')
   * @param config - Connector configuration
   *
   * @example
   * ```typescript
   * connectorRegistry.register('github', {
   *   displayName: 'GitHub API',
   *   description: 'Access GitHub repos and user data',
   *   baseURL: 'https://api.github.com',
   *   auth: {
   *     type: 'oauth',
   *     flow: 'authorization_code',
   *     clientId: process.env.GITHUB_CLIENT_ID!,
   *     clientSecret: process.env.GITHUB_CLIENT_SECRET,
   *     tokenUrl: 'https://github.com/login/oauth/access_token',
   *     authorizationUrl: 'https://github.com/login/oauth/authorize',
   *     scope: 'user:email repo'
   *   }
   * });
   * ```
   */
  register(name: string, config: ConnectorRegistrationConfig): void {
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error('Connector name cannot be empty');
    }

    if (this.connectors.has(name)) {
      console.warn(`Connector '${name}' is already registered. Overwriting...`);
    }

    // Handle both new ConnectorConfig and legacy format
    let connectorConfig: ConnectorConfig;
    let oauthManager: OAuthManager;

    if ('oauth' in config) {
      // Legacy format
      const legacyConfig = config as LegacyProviderRegistrationConfig;

      // Convert to ConnectorConfig
      connectorConfig = {
        displayName: legacyConfig.displayName,
        description: legacyConfig.description,
        baseURL: legacyConfig.baseURL,
        auth: this.convertLegacyOAuthToConnectorAuth(legacyConfig.oauth),
      };

      // Create OAuthManager
      oauthManager = legacyConfig.oauth instanceof OAuthManager
        ? legacyConfig.oauth
        : new OAuthManager(legacyConfig.oauth);
    } else {
      // New ConnectorConfig format
      connectorConfig = config as ConnectorConfig;

      // Create OAuthManager from ConnectorAuth
      oauthManager = this.createOAuthManagerFromConnectorAuth(name, connectorConfig.auth);
    }

    // Create connector implementing IConnector interface
    const connector = new OAuthConnector(name, connectorConfig, oauthManager);

    this.connectors.set(name, connector);
  }

  /**
   * Get connector by name
   *
   * @throws Error if connector not found
   */
  get(name: string): IConnector {
    const connector = this.connectors.get(name);

    if (!connector) {
      const available = this.listConnectorNames();
      const availableList = available.length > 0 ? available.join(', ') : 'none';

      throw new Error(
        `Connector '${name}' not found. Available connectors: ${availableList}`
      );
    }

    return connector;
  }

  /**
   * Get OAuthManager for a connector (for internal use)
   * @internal
   */
  getManager(name: string): OAuthManager {
    const connector = this.get(name);
    if (connector instanceof OAuthConnector) {
      return (connector as any).oauthManager;
    }
    throw new Error(`Connector '${name}' does not have an OAuthManager`);
  }

  /**
   * Check if connector exists
   */
  has(name: string): boolean {
    return this.connectors.has(name);
  }

  /**
   * Get all registered connector names
   */
  listConnectorNames(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Get all registered connectors
   */
  listConnectors(): IConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Get connector descriptions formatted for tool parameters
   */
  getConnectorDescriptionsForTools(): string {
    const connectors = this.listConnectors();

    if (connectors.length === 0) {
      return 'No connectors registered yet.';
    }

    return connectors
      .map((c) => `  - "${c.name}": ${c.displayName} - ${c.config.description}`)
      .join('\n');
  }

  /**
   * Get connector info (for tools and documentation)
   */
  getConnectorInfo(): Record<string, { displayName: string; description: string; baseURL: string }> {
    const info: Record<string, any> = {};

    for (const [name, connector] of this.connectors) {
      info[name] = {
        displayName: connector.displayName,
        description: connector.config.description,
        baseURL: connector.baseURL,
      };
    }

    return info;
  }

  /**
   * Unregister a connector
   */
  unregister(name: string): boolean {
    return this.connectors.delete(name);
  }

  /**
   * Clear all connectors (useful for testing)
   */
  clear(): void {
    this.connectors.clear();
  }

  /**
   * Get number of registered connectors
   */
  size(): number {
    return this.connectors.size;
  }

  // ==================== Legacy Compatibility ====================

  /**
   * @deprecated Use listConnectors() instead
   */
  listProviders(): IConnector[] {
    return this.listConnectors();
  }

  /**
   * @deprecated Use listConnectorNames() instead
   */
  listProviderNames(): string[] {
    return this.listConnectorNames();
  }

  // ==================== Internal Helpers ====================

  /**
   * Convert legacy OAuth config to new ConnectorAuth format
   */
  private convertLegacyOAuthToConnectorAuth(oauth: OAuthConfig | OAuthManager): ConnectorAuth {
    if (oauth instanceof OAuthManager) {
      // Can't extract config from manager, use placeholder
      return {
        type: 'oauth',
        flow: 'client_credentials',
        clientId: 'legacy',
        tokenUrl: 'legacy',
      };
    }

    // Convert OAuthConfig to ConnectorAuth
    return {
      type: 'oauth',
      flow: oauth.flow as any,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
      tokenUrl: oauth.tokenUrl,
      authorizationUrl: oauth.authorizationUrl,
      redirectUri: oauth.redirectUri,
      scope: oauth.scope,
      usePKCE: oauth.usePKCE,
      privateKey: oauth.privateKey,
      privateKeyPath: oauth.privateKeyPath,
      audience: oauth.audience,
      refreshBeforeExpiry: oauth.refreshBeforeExpiry,
      storageKey: oauth.storageKey,
    };
  }

  /**
   * Create OAuthManager from new ConnectorAuth format
   */
  private createOAuthManagerFromConnectorAuth(name: string, auth: ConnectorAuth): OAuthManager {
    if (auth.type === 'api_key') {
      // API key → static_token flow
      return new OAuthManager({
        flow: 'static_token',
        staticToken: auth.apiKey,
        clientId: name,
        tokenUrl: '',
      });
    }

    if (auth.type === 'oauth') {
      // OAuth → corresponding flow
      const oauthConfig: OAuthConfig = {
        flow: auth.flow,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
        tokenUrl: auth.tokenUrl,
        authorizationUrl: auth.authorizationUrl,
        redirectUri: auth.redirectUri,
        scope: auth.scope,
        usePKCE: auth.usePKCE,
        privateKey: auth.privateKey,
        privateKeyPath: auth.privateKeyPath,
        audience: auth.audience,
        refreshBeforeExpiry: auth.refreshBeforeExpiry,
        storageKey: auth.storageKey,
      };

      return new OAuthManager(oauthConfig);
    }

    if (auth.type === 'jwt') {
      // JWT → jwt_bearer flow
      return new OAuthManager({
        flow: 'jwt_bearer',
        clientId: auth.clientId,
        tokenUrl: auth.tokenUrl,
        privateKey: auth.privateKey,
        privateKeyPath: auth.privateKeyPath,
        scope: auth.scope,
        audience: auth.audience,
      });
    }

    throw new Error(`Unknown connector auth type: ${(auth as any).type}`);
  }
}

/**
 * Global connector registry singleton
 *
 * @example
 * ```typescript
 * import { connectorRegistry } from '@oneringai/agents';
 *
 * connectorRegistry.register('github', {
 *   displayName: 'GitHub API',
 *   description: 'Access GitHub repos and user data',
 *   baseURL: 'https://api.github.com',
 *   auth: { type: 'oauth', flow: 'authorization_code', ... }
 * });
 * ```
 */
export const connectorRegistry = ConnectorRegistry.getInstance();

/**
 * @deprecated Use connectorRegistry instead
 * Kept for backward compatibility - will be removed in v0.3.0
 */
export const oauthRegistry = connectorRegistry;

/**
 * Legacy type alias for backward compatibility
 * @deprecated Use IConnector instead
 */
export type RegisteredProvider = IConnector;

/**
 * Legacy type alias for backward compatibility
 * @deprecated Use IConnector instead
 */
export type RegisteredConnector = IConnector;

/**
 * Legacy class alias for backward compatibility
 * @deprecated Use ConnectorRegistry instead
 */
export const OAuthRegistry = ConnectorRegistry;
