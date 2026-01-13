/**
 * Connector - Represents authenticated connection to external systems
 *
 * Connectors handle authentication and API access to third-party services
 * (GitHub, Microsoft, Salesforce, etc.)
 *
 * This is DIFFERENT from Providers (OpenAI, Anthropic) which provide AI capabilities.
 */

/**
 * Connector authentication configuration
 * Supports OAuth 2.0, API keys, and JWT bearer tokens
 */
export type ConnectorAuth =
  | OAuthConnectorAuth
  | APIKeyConnectorAuth
  | JWTConnectorAuth;

/**
 * OAuth 2.0 authentication for connectors
 * Supports multiple OAuth flows
 */
export interface OAuthConnectorAuth {
  type: 'oauth';
  flow: 'authorization_code' | 'client_credentials' | 'jwt_bearer';

  // OAuth configuration
  clientId: string;
  clientSecret?: string;
  tokenUrl: string;

  // Authorization code flow specific
  authorizationUrl?: string;
  redirectUri?: string;
  scope?: string;
  usePKCE?: boolean;

  // JWT bearer flow specific
  privateKey?: string;
  privateKeyPath?: string;
  issuer?: string;
  subject?: string;
  audience?: string;

  // Advanced options
  refreshBeforeExpiry?: number; // Seconds before expiry to refresh (default: 300)
  storageKey?: string; // Custom storage key
}

/**
 * Static API key authentication
 * For services like OpenAI, Anthropic, many SaaS APIs
 */
export interface APIKeyConnectorAuth {
  type: 'api_key';
  apiKey: string;
  headerName?: string; // Default: "Authorization"
  headerPrefix?: string; // Default: "Bearer"
}

/**
 * JWT Bearer token authentication
 * For service accounts (Google, Salesforce)
 */
export interface JWTConnectorAuth {
  type: 'jwt';
  privateKey: string;
  privateKeyPath?: string;
  tokenUrl: string;
  clientId: string;
  scope?: string;
  issuer?: string;
  subject?: string;
  audience?: string;
}

/**
 * Complete connector configuration
 * Used to register external system connections
 */
export interface ConnectorConfig {
  // Identity
  displayName: string; // Human-readable name (e.g., "GitHub API")
  description: string; // What this connector provides access to
  baseURL: string; // API base URL

  // Authentication
  auth: ConnectorAuth;

  // Optional metadata
  apiVersion?: string; // API version (e.g., "v1", "2024-01-01")
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
  documentation?: string; // URL to API documentation
  tags?: string[]; // Categorization tags
}

/**
 * Result from ProviderConfigAgent
 * Includes setup instructions and environment variables
 */
export interface ConnectorConfigResult {
  name: string; // Connector identifier (e.g., "github", "microsoft")
  config: ConnectorConfig; // Full configuration
  setupInstructions: string; // Step-by-step setup guide
  envVariables: string[]; // Required environment variables
  setupUrl?: string; // Direct URL to credential setup page
}
