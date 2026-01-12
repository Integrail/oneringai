/**
 * OAuth 2.0 Plugin for @oneringai/agents
 *
 * Supports multiple OAuth flows with encrypted token storage:
 * - Authorization Code with PKCE
 * - Client Credentials
 * - JWT Bearer
 *
 * Plus global provider registry and authenticated fetch for easy integration.
 */

export { OAuthManager } from './OAuthManager.js';

// Registry and authenticated fetch
export { oauthRegistry, OAuthRegistry } from './OAuthRegistry.js';
export type { RegisteredProvider, ProviderRegistrationConfig } from './OAuthRegistry.js';
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
