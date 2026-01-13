/**
 * Connector Plugin for @oneringai/agents
 *
 * Connectors provide authenticated access to external system APIs
 * (GitHub, Microsoft, Salesforce, etc.)
 *
 * Supports multiple authentication methods:
 * - OAuth 2.0 (Authorization Code with PKCE, Client Credentials, JWT Bearer)
 * - API Keys
 * - JWT Bearer Tokens
 *
 * IMPORTANT: Connectors are DIFFERENT from Providers
 * - Connectors: External system authentication (GitHub, Microsoft)
 * - Providers: AI capabilities (OpenAI, Anthropic)
 */

export { OAuthManager } from './OAuthManager.js';

// NEW: Connector Registry (recommended)
export {
  connectorRegistry,
  ConnectorRegistry,
  oauthRegistry, // @deprecated - use connectorRegistry
  OAuthRegistry, // @deprecated - use ConnectorRegistry
} from './ConnectorRegistry.js';

export type {
  ConnectorRegistrationConfig,
  RegisteredProvider, // @deprecated - use IConnector
  RegisteredConnector, // @deprecated - use IConnector
  LegacyProviderRegistrationConfig,
} from './ConnectorRegistry.js';

export { OAuthConnector } from './OAuthConnector.js';

// Authenticated fetch (works with connectors)
export { authenticatedFetch, createAuthenticatedFetch } from './authenticatedFetch.js';
export { generateWebAPITool } from './toolGenerator.js';

// Storage implementations
export { MemoryStorage } from './infrastructure/storage/MemoryStorage.js';
export { FileStorage } from './infrastructure/storage/FileStorage.js';
export type { FileStorageConfig } from './infrastructure/storage/FileStorage.js';

// Types
export type {
  OAuthConfig,
  OAuthFlow,
  TokenResponse,
  StoredToken,
} from './types.js';

export type { ITokenStorage } from './domain/ITokenStorage.js';

// Utilities (for advanced users)
export { generatePKCE, generateState } from './utils/pkce.js';
export { encrypt, decrypt, generateEncryptionKey } from './utils/encryption.js';
