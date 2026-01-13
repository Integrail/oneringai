/**
 * Connectors - Authenticated access to external system APIs
 *
 * Provides unified interface for authentication across different systems:
 * - GitHub, Microsoft, Google, Salesforce, etc.
 *
 * Supports multiple authentication methods:
 * - OAuth 2.0 (Authorization Code + PKCE, Client Credentials, JWT Bearer)
 * - API Keys
 * - SAML (future)
 * - Kerberos (future)
 */

// Registry
export {
  ConnectorRegistry,
} from './ConnectorRegistry.js';

// Export singleton instance
import { ConnectorRegistry } from './ConnectorRegistry.js';
export const connectorRegistry = ConnectorRegistry.getInstance();

export type {
  ConnectorRegistrationConfig,
} from './ConnectorRegistry.js';

// OAuth connectors
export {
  OAuthManager,
  OAuthConnector,
} from './oauth/index.js';

export type {
  OAuthConfig,
  OAuthFlow,
  TokenResponse,
  StoredToken,
} from './oauth/types.js';

export type { ITokenStorage } from './oauth/domain/ITokenStorage.js';

// Storage implementations
export { MemoryStorage } from './oauth/infrastructure/storage/MemoryStorage.js';
export { FileStorage } from './oauth/infrastructure/storage/FileStorage.js';
export type { FileStorageConfig } from './oauth/infrastructure/storage/FileStorage.js';

// Utilities
export { authenticatedFetch, createAuthenticatedFetch } from './authenticatedFetch.js';
export { generateWebAPITool } from './toolGenerator.js';

// OAuth utilities (for advanced users)
export { generatePKCE, generateState } from './oauth/utils/pkce.js';
export { encrypt, decrypt, generateEncryptionKey } from './oauth/utils/encryption.js';
