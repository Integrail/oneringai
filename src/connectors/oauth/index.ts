/**
 * OAuth 2.0 Authentication for Connectors
 */

export { OAuthManager } from './OAuthManager.js';
export { OAuthConnector } from './OAuthConnector.js';

// Legacy aliases
export { ConnectorRegistry as OAuthRegistry } from '../ConnectorRegistry.js';
export { connectorRegistry as oauthRegistry } from '../ConnectorRegistry.js';

export type {
  OAuthConfig,
  OAuthFlow,
  TokenResponse,
  StoredToken,
} from './types.js';
