/**
 * Connector - Represents authenticated connection to ANY API
 *
 * Connectors handle authentication for:
 * - AI providers (OpenAI, Anthropic, Google, etc.)
 * - External APIs (GitHub, Microsoft, Salesforce, etc.)
 *
 * This is the SINGLE source of truth for authentication.
 */

import type { Vendor } from '../../core/Vendor.js';

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
 * Used for BOTH AI providers AND external APIs
 */
export interface ConnectorConfig {
  // Unique identifier (required for Connector.create())
  name?: string; // e.g., 'openai-main', 'openai-backup', 'github-user'

  // For AI providers: specify vendor (auto-selects SDK)
  vendor?: Vendor; // e.g., Vendor.OpenAI, Vendor.Anthropic

  // Authentication
  auth: ConnectorAuth;

  // Optional identity
  displayName?: string; // Human-readable name
  description?: string; // What this connector provides

  // Optional: Override default baseURL (required for Custom vendor)
  baseURL?: string;

  // Optional: Default model for AI providers
  defaultModel?: string;

  // Optional metadata
  apiVersion?: string;
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
  documentation?: string;
  tags?: string[];

  // Vendor-specific options
  options?: {
    timeout?: number;
    maxRetries?: number;
    organization?: string; // OpenAI
    project?: string; // OpenAI
    anthropicVersion?: string;
    location?: string; // Google Vertex
    projectId?: string; // Google Vertex
    [key: string]: unknown;
  };
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
