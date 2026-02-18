import { V as Vendor } from './Vendor-DYh_bzwo.cjs';

/**
 * Connector - Represents authenticated connection to ANY API
 *
 * Connectors handle authentication for:
 * - AI providers (OpenAI, Anthropic, Google, etc.)
 * - External APIs (GitHub, Microsoft, Salesforce, etc.)
 *
 * This is the SINGLE source of truth for authentication.
 */

/**
 * No authentication (for testing/mock providers)
 */
interface NoneConnectorAuth {
    type: 'none';
}
/**
 * Connector authentication configuration
 * Supports OAuth 2.0, API keys, JWT bearer tokens, and none (for testing)
 */
type ConnectorAuth = OAuthConnectorAuth | APIKeyConnectorAuth | JWTConnectorAuth | NoneConnectorAuth;
/**
 * OAuth 2.0 authentication for connectors
 * Supports multiple OAuth flows
 */
interface OAuthConnectorAuth {
    type: 'oauth';
    flow: 'authorization_code' | 'client_credentials' | 'jwt_bearer';
    clientId: string;
    clientSecret?: string;
    tokenUrl: string;
    authorizationUrl?: string;
    redirectUri?: string;
    scope?: string;
    usePKCE?: boolean;
    privateKey?: string;
    privateKeyPath?: string;
    issuer?: string;
    subject?: string;
    audience?: string;
    refreshBeforeExpiry?: number;
    storageKey?: string;
    /** Vendor-specific extra credentials */
    extra?: Record<string, string>;
}
/**
 * Static API key authentication
 * For services like OpenAI, Anthropic, many SaaS APIs
 */
interface APIKeyConnectorAuth {
    type: 'api_key';
    apiKey: string;
    headerName?: string;
    headerPrefix?: string;
    /**
     * Vendor-specific extra credentials beyond the primary API key.
     * E.g., Slack Socket Mode needs { appToken: 'xapp-...', signingSecret: '...' }
     */
    extra?: Record<string, string>;
}
/**
 * JWT Bearer token authentication
 * For service accounts (Google, Salesforce)
 */
interface JWTConnectorAuth {
    type: 'jwt';
    privateKey: string;
    privateKeyPath?: string;
    tokenUrl: string;
    clientId: string;
    scope?: string;
    issuer?: string;
    subject?: string;
    audience?: string;
    /** Vendor-specific extra credentials */
    extra?: Record<string, string>;
}
/**
 * Complete connector configuration
 * Used for BOTH AI providers AND external APIs
 */
interface ConnectorConfig {
    name?: string;
    vendor?: Vendor;
    serviceType?: string;
    auth: ConnectorAuth;
    displayName?: string;
    description?: string;
    baseURL?: string;
    defaultModel?: string;
    apiVersion?: string;
    rateLimit?: {
        requestsPerMinute?: number;
        requestsPerDay?: number;
    };
    documentation?: string;
    tags?: string[];
    options?: {
        organization?: string;
        project?: string;
        anthropicVersion?: string;
        location?: string;
        projectId?: string;
        [key: string]: unknown;
    };
    /**
     * Request timeout in milliseconds
     * @default 30000 (30 seconds)
     */
    timeout?: number;
    /**
     * Retry configuration for transient failures
     */
    retry?: {
        /** Maximum number of retry attempts @default 3 */
        maxRetries?: number;
        /** HTTP status codes that trigger retry @default [429, 500, 502, 503, 504] */
        retryableStatuses?: number[];
        /** Base delay in ms for exponential backoff @default 1000 */
        baseDelayMs?: number;
        /** Maximum delay in ms @default 30000 */
        maxDelayMs?: number;
    };
    /**
     * Circuit breaker configuration for failing services
     */
    circuitBreaker?: {
        /** Enable circuit breaker @default true */
        enabled?: boolean;
        /** Number of failures before opening circuit @default 5 */
        failureThreshold?: number;
        /** Number of successes to close circuit @default 2 */
        successThreshold?: number;
        /** Time in ms before attempting to close circuit @default 30000 */
        resetTimeoutMs?: number;
    };
    /**
     * Logging configuration for requests/responses
     */
    logging?: {
        /** Enable request/response logging @default false */
        enabled?: boolean;
        /** Log request/response bodies (security risk) @default false */
        logBody?: boolean;
        /** Log request/response headers (security risk) @default false */
        logHeaders?: boolean;
    };
}
/**
 * Result from ProviderConfigAgent
 * Includes setup instructions and environment variables
 */
interface ConnectorConfigResult {
    name: string;
    config: ConnectorConfig;
    setupInstructions: string;
    envVariables: string[];
    setupUrl?: string;
}

/**
 * Token storage interface (Clean Architecture - Domain Layer)
 * All implementations must encrypt tokens at rest
 */
interface StoredToken {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    obtained_at: number;
}
/**
 * Token storage interface
 * All implementations MUST encrypt tokens before storing
 */
interface ITokenStorage {
    /**
     * Store token (must be encrypted by implementation)
     *
     * @param key - Unique identifier for this token
     * @param token - Token data to store
     */
    storeToken(key: string, token: StoredToken): Promise<void>;
    /**
     * Retrieve token (must be decrypted by implementation)
     *
     * @param key - Unique identifier for the token
     * @returns Decrypted token or null if not found
     */
    getToken(key: string): Promise<StoredToken | null>;
    /**
     * Delete token
     *
     * @param key - Unique identifier for the token
     */
    deleteToken(key: string): Promise<void>;
    /**
     * Check if token exists
     *
     * @param key - Unique identifier for the token
     * @returns True if token exists
     */
    hasToken(key: string): Promise<boolean>;
}

/**
 * IConnectorRegistry - Read-only interface for connector lookup
 *
 * Covers the read-only subset of Connector static methods.
 * Used by ScopedConnectorRegistry to provide filtered views
 * and by consumers that only need to read from the registry.
 */

interface IConnectorRegistry {
    /** Get a connector by name. Throws if not found (or not accessible). */
    get(name: string): Connector;
    /** Check if a connector exists (and is accessible) */
    has(name: string): boolean;
    /** List all accessible connector names */
    list(): string[];
    /** List all accessible connector instances */
    listAll(): Connector[];
    /** Get number of accessible connectors */
    size(): number;
    /** Get connector descriptions formatted for tool parameters */
    getDescriptionsForTools(): string;
    /** Get connector info map */
    getInfo(): Record<string, {
        displayName: string;
        description: string;
        baseURL: string;
    }>;
}

/**
 * IConnectorAccessPolicy - Pluggable access control for connector registry
 *
 * Policies are sync-only for performance — access checks must be fast
 * and policy data should be in-memory.
 */

/**
 * Opaque context passed to access policy checks.
 * Library imposes no structure — consumers define their own shape
 * (e.g., { userId, tenantId, roles }).
 */
type ConnectorAccessContext = Record<string, unknown>;
interface IConnectorAccessPolicy {
    /**
     * Check if a connector is accessible in the given context.
     * Receives the full Connector instance so it can inspect
     * config.tags, vendor, serviceType, etc.
     */
    canAccess(connector: Connector, context: ConnectorAccessContext): boolean;
}

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

/**
 * Default configuration values for resilience features
 */
declare const DEFAULT_CONNECTOR_TIMEOUT = 30000;
declare const DEFAULT_MAX_RETRIES = 3;
declare const DEFAULT_RETRYABLE_STATUSES: number[];
declare const DEFAULT_BASE_DELAY_MS = 1000;
declare const DEFAULT_MAX_DELAY_MS = 30000;
/**
 * Fetch options with additional connector-specific settings
 */
interface ConnectorFetchOptions extends RequestInit {
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
declare class Connector {
    private static registry;
    /**
     * Create and register a new connector
     * @param config - Must include `name` field
     */
    static create(config: ConnectorConfig & {
        name: string;
    }): Connector;
    /**
     * Get a connector by name
     */
    static get(name: string): Connector;
    /**
     * Check if a connector exists
     */
    static has(name: string): boolean;
    /**
     * List all registered connector names
     */
    static list(): string[];
    /**
     * Remove a connector
     */
    static remove(name: string): boolean;
    /**
     * Clear all connectors (useful for testing)
     */
    static clear(): void;
    /**
     * Get the default token storage for OAuth connectors.
     * Resolves from StorageRegistry, falling back to MemoryStorage.
     */
    private static get defaultStorage();
    /**
     * Set default token storage for OAuth connectors
     */
    static setDefaultStorage(storage: ITokenStorage): void;
    /**
     * Get all registered connectors
     */
    static listAll(): Connector[];
    /**
     * Get number of registered connectors
     */
    static size(): number;
    private static _accessPolicy;
    /**
     * Set a global access policy for connector scoping.
     * Pass null to clear the policy.
     */
    static setAccessPolicy(policy: IConnectorAccessPolicy | null): void;
    /**
     * Get the current global access policy (or null if none set).
     */
    static getAccessPolicy(): IConnectorAccessPolicy | null;
    /**
     * Create a scoped (filtered) view of the connector registry.
     * Requires a global access policy to be set via setAccessPolicy().
     *
     * @param context - Opaque context passed to the policy (e.g., { userId, tenantId })
     * @returns IConnectorRegistry that only exposes accessible connectors
     * @throws Error if no access policy is set
     */
    static scoped(context: ConnectorAccessContext): IConnectorRegistry;
    /**
     * Return the static Connector methods as an IConnectorRegistry object (unfiltered).
     * Useful when code accepts the interface but you want the full admin view.
     */
    static asRegistry(): IConnectorRegistry;
    /**
     * Get connector descriptions formatted for tool parameters
     * Useful for generating dynamic tool descriptions
     */
    static getDescriptionsForTools(): string;
    /**
     * Get connector info (for tools and documentation)
     */
    static getInfo(): Record<string, {
        displayName: string;
        description: string;
        baseURL: string;
    }>;
    readonly name: string;
    readonly vendor?: Vendor;
    readonly config: ConnectorConfig;
    private oauthManager?;
    private circuitBreaker?;
    private disposed;
    private requestCount;
    private successCount;
    private failureCount;
    private totalLatencyMs;
    private constructor();
    /**
     * Initialize circuit breaker with config or defaults
     */
    private initCircuitBreaker;
    /**
     * Human-readable display name
     */
    get displayName(): string;
    /**
     * API base URL for this connector
     */
    get baseURL(): string;
    /**
     * Get the API key (for api_key auth type)
     */
    getApiKey(): string;
    /**
     * Get the current access token (for OAuth, JWT, or API key)
     * Handles automatic refresh if needed
     */
    getToken(userId?: string): Promise<string>;
    /**
     * Start OAuth authorization flow
     * Returns the URL to redirect the user to
     */
    startAuth(userId?: string): Promise<string>;
    /**
     * Handle OAuth callback
     * Call this after user is redirected back from OAuth provider
     */
    handleCallback(callbackUrl: string, userId?: string): Promise<void>;
    /**
     * Check if the connector has a valid token
     */
    hasValidToken(userId?: string): Promise<boolean>;
    /**
     * Get vendor-specific options from config
     */
    getOptions(): Record<string, unknown>;
    /**
     * Get the service type (explicit or undefined)
     */
    get serviceType(): string | undefined;
    /**
     * Get connector metrics
     */
    getMetrics(): {
        requestCount: number;
        successCount: number;
        failureCount: number;
        avgLatencyMs: number;
        circuitBreakerState?: string;
    };
    /**
     * Reset circuit breaker (force close)
     */
    resetCircuitBreaker(): void;
    /**
     * Make an authenticated fetch request using this connector
     * This is the foundation for all vendor-dependent tools
     *
     * Features:
     * - Timeout with AbortController
     * - Circuit breaker protection
     * - Retry with exponential backoff
     * - Request/response logging
     *
     * @param endpoint - API endpoint (relative to baseURL) or full URL
     * @param options - Fetch options with connector-specific settings
     * @param userId - Optional user ID for multi-user OAuth
     * @returns Fetch Response
     */
    fetch(endpoint: string, options?: ConnectorFetchOptions, userId?: string): Promise<Response>;
    /**
     * Make an authenticated fetch request and parse JSON response
     * Throws on non-OK responses
     *
     * @param endpoint - API endpoint (relative to baseURL) or full URL
     * @param options - Fetch options with connector-specific settings
     * @param userId - Optional user ID for multi-user OAuth
     * @returns Parsed JSON response
     */
    fetchJSON<T = unknown>(endpoint: string, options?: ConnectorFetchOptions, userId?: string): Promise<T>;
    private sleep;
    private logRequest;
    private logResponse;
    /**
     * Dispose of resources
     */
    dispose(): void;
    /**
     * Check if connector is disposed
     */
    isDisposed(): boolean;
    private initOAuthManager;
    private initJWTManager;
}

/**
 * Base provider interface
 */
interface ProviderCapabilities {
    text: boolean;
    images: boolean;
    videos: boolean;
    audio: boolean;
    /** Optional feature flags for specific capabilities */
    features?: Record<string, boolean>;
}
interface IProvider {
    readonly name: string;
    readonly vendor?: string;
    readonly capabilities: ProviderCapabilities;
    /**
     * Validate that the provider configuration is correct
     */
    validateConfig(): Promise<boolean>;
}

export { type APIKeyConnectorAuth as A, type ConnectorAccessContext as C, DEFAULT_CONNECTOR_TIMEOUT as D, type IConnectorRegistry as I, type JWTConnectorAuth as J, type OAuthConnectorAuth as O, type ProviderCapabilities as P, type StoredToken as S, type IConnectorAccessPolicy as a, Connector as b, type ConnectorConfig as c, type ITokenStorage as d, type IProvider as e, type ConnectorFetchOptions as f, type ConnectorAuth as g, type ConnectorConfigResult as h, DEFAULT_MAX_RETRIES as i, DEFAULT_RETRYABLE_STATUSES as j, DEFAULT_BASE_DELAY_MS as k, DEFAULT_MAX_DELAY_MS as l };
