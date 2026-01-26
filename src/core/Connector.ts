/**
 * Connector - The single source of truth for authentication
 *
 * Manages authenticated connections to:
 * - AI providers (OpenAI, Anthropic, Google, etc.)
 * - External APIs (GitHub, Salesforce, etc.)
 *
 * Enterprise features:
 * - Request timeout with AbortController
 * - Circuit breaker for failing services
 * - Retry with exponential backoff
 * - Request/response logging
 */

import { ConnectorConfig, ConnectorAuth } from '../domain/entities/Connector.js';
import { Vendor } from './Vendor.js';
import { OAuthManager } from '../connectors/oauth/OAuthManager.js';
import { MemoryStorage } from '../connectors/oauth/infrastructure/storage/MemoryStorage.js';
import type { ITokenStorage } from '../connectors/oauth/domain/ITokenStorage.js';
import { CircuitBreaker, CircuitOpenError } from '../infrastructure/resilience/CircuitBreaker.js';
import { calculateBackoff, BackoffConfig } from '../infrastructure/resilience/BackoffStrategy.js';
import { logger } from '../infrastructure/observability/Logger.js';
import { metrics } from '../infrastructure/observability/Metrics.js';

/**
 * Default configuration values for resilience features
 */
export const DEFAULT_CONNECTOR_TIMEOUT = 30000; // 30 seconds
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
export const DEFAULT_BASE_DELAY_MS = 1000;
export const DEFAULT_MAX_DELAY_MS = 30000;

/**
 * Fetch options with additional connector-specific settings
 */
export interface ConnectorFetchOptions extends RequestInit {
  /** Override timeout for this request */
  timeout?: number;
  /** Skip retry for this request */
  skipRetry?: boolean;
  /** Skip circuit breaker for this request */
  skipCircuitBreaker?: boolean;
}

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

  /**
   * Get all registered connectors
   */
  static listAll(): Connector[] {
    return Array.from(Connector.registry.values());
  }

  /**
   * Get number of registered connectors
   */
  static size(): number {
    return Connector.registry.size;
  }

  /**
   * Get connector descriptions formatted for tool parameters
   * Useful for generating dynamic tool descriptions
   */
  static getDescriptionsForTools(): string {
    const connectors = Connector.listAll();

    if (connectors.length === 0) {
      return 'No connectors registered yet.';
    }

    return connectors
      .map((c) => `  - "${c.name}": ${c.displayName} - ${c.config.description || 'No description'}`)
      .join('\n');
  }

  /**
   * Get connector info (for tools and documentation)
   */
  static getInfo(): Record<string, { displayName: string; description: string; baseURL: string }> {
    const info: Record<string, { displayName: string; description: string; baseURL: string }> = {};

    for (const connector of Connector.registry.values()) {
      info[connector.name] = {
        displayName: connector.displayName,
        description: connector.config.description || '',
        baseURL: connector.baseURL,
      };
    }

    return info;
  }

  // ============ Instance ============

  readonly name: string;
  readonly vendor?: Vendor;
  readonly config: ConnectorConfig;

  private oauthManager?: OAuthManager;
  private circuitBreaker?: CircuitBreaker;
  private disposed = false;

  // Metrics
  private requestCount = 0;
  private successCount = 0;
  private failureCount = 0;
  private totalLatencyMs = 0;

  private constructor(config: ConnectorConfig & { name: string }) {
    this.name = config.name;
    this.vendor = config.vendor;
    this.config = config;

    // Initialize OAuth manager for OAuth and JWT auth types
    if (config.auth.type === 'oauth') {
      this.initOAuthManager(config.auth);
    } else if (config.auth.type === 'jwt') {
      this.initJWTManager(config.auth);
    }

    // Initialize circuit breaker if enabled (default: true)
    this.initCircuitBreaker();
  }

  /**
   * Initialize circuit breaker with config or defaults
   */
  private initCircuitBreaker(): void {
    const cbConfig = this.config.circuitBreaker;
    const enabled = cbConfig?.enabled ?? true;

    if (enabled) {
      this.circuitBreaker = new CircuitBreaker(`connector:${this.name}`, {
        failureThreshold: cbConfig?.failureThreshold ?? 5,
        successThreshold: cbConfig?.successThreshold ?? 2,
        resetTimeoutMs: cbConfig?.resetTimeoutMs ?? 30000,
        windowMs: 60000, // 1 minute window
        isRetryable: (error) => {
          // Don't count client errors (4xx except 429) as circuit breaker failures
          if (error.message.includes('HTTP 4') && !error.message.includes('HTTP 429')) {
            return false;
          }
          return true;
        },
      });

      // Log circuit breaker state changes
      this.circuitBreaker.on('opened', ({ name, failureCount, lastError }) => {
        logger.warn(`Circuit breaker opened for ${name}: ${failureCount} failures, last error: ${lastError}`);
        metrics.increment('connector.circuit_breaker.opened', 1, { connector: this.name });
      });

      this.circuitBreaker.on('closed', ({ name }) => {
        logger.info(`Circuit breaker closed for ${name}`);
        metrics.increment('connector.circuit_breaker.closed', 1, { connector: this.name });
      });
    }
  }

  /**
   * Human-readable display name
   */
  get displayName(): string {
    return this.config.displayName || this.name;
  }

  /**
   * API base URL for this connector
   */
  get baseURL(): string {
    return this.config.baseURL || '';
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
   * Get the current access token (for OAuth, JWT, or API key)
   * Handles automatic refresh if needed
   */
  async getToken(userId?: string): Promise<string> {
    if (this.config.auth.type === 'api_key') {
      return this.config.auth.apiKey;
    }

    // OAuth and JWT both use OAuthManager
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
   * Get the service type (explicit or undefined)
   */
  get serviceType(): string | undefined {
    return this.config.serviceType;
  }

  /**
   * Make an authenticated fetch request using this connector
   * This is the foundation for all vendor-dependent tools
   *
   * @param endpoint - API endpoint (relative to baseURL) or full URL
   * @param options - Standard fetch options
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Fetch Response
   */
  async fetch(
    endpoint: string,
    options?: RequestInit,
    userId?: string
  ): Promise<Response> {
    const token = await this.getToken(userId);
    const auth = this.config.auth;

    // Build auth header based on auth type
    let headerName = 'Authorization';
    let headerValue = `Bearer ${token}`;

    if (auth.type === 'api_key') {
      headerName = auth.headerName || 'Authorization';
      const prefix = auth.headerPrefix ?? 'Bearer';
      headerValue = prefix ? `${prefix} ${token}` : token;
    }

    // Resolve URL (relative to baseURL or absolute)
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        [headerName]: headerValue,
      },
    });
  }

  /**
   * Make an authenticated fetch request and parse JSON response
   * Throws on non-OK responses
   *
   * @param endpoint - API endpoint (relative to baseURL) or full URL
   * @param options - Standard fetch options
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Parsed JSON response
   */
  async fetchJSON<T = unknown>(endpoint: string, options?: RequestInit, userId?: string): Promise<T> {
    const response = await this.fetch(endpoint, options, userId);

    // Try to parse response body
    const text = await response.text();
    let data: T;

    try {
      data = JSON.parse(text) as T;
    } catch {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }

    if (!response.ok) {
      // Include parsed error in message if available
      const errorMsg =
        typeof data === 'object' && data !== null
          ? JSON.stringify(data)
          : text;
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }

    return data;
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
      audience: auth.audience,
      refreshBeforeExpiry: auth.refreshBeforeExpiry,
      storage: Connector.defaultStorage,
      storageKey: auth.storageKey ?? this.name,
    };

    this.oauthManager = new OAuthManager(oauthConfig);
  }

  private initJWTManager(auth: ConnectorAuth & { type: 'jwt' }): void {
    // JWT uses jwt_bearer flow via OAuthManager
    this.oauthManager = new OAuthManager({
      flow: 'jwt_bearer',
      clientId: auth.clientId,
      tokenUrl: auth.tokenUrl,
      privateKey: auth.privateKey,
      privateKeyPath: auth.privateKeyPath,
      scope: auth.scope,
      audience: auth.audience,
      storage: Connector.defaultStorage,
      storageKey: this.name,
    });
  }
}
