/**
 * Connector Interface
 *
 * Represents an authenticated connection to an external system API
 * (GitHub, Microsoft, Salesforce, Slack, etc.)
 *
 * IMPORTANT: This is DIFFERENT from IProvider (OpenAI, Anthropic)
 * - Providers: AI capabilities (text generation, vision, etc.)
 * - Connectors: External system authentication and API access
 */

import { ConnectorConfig } from '../entities/Connector.js';

/**
 * Connector interface for external system authentication
 */
export interface IConnector {
  /**
   * Unique connector name (e.g., "github", "microsoft")
   */
  readonly name: string;

  /**
   * Human-readable display name (e.g., "GitHub API")
   */
  readonly displayName: string;

  /**
   * API base URL
   */
  readonly baseURL: string;

  /**
   * Connector configuration
   */
  readonly config: ConnectorConfig;

  /**
   * Get valid access token for API calls
   * Automatically refreshes if expired (for OAuth)
   *
   * @param userId - Optional user identifier for multi-user support
   * @returns Access token for API authorization
   */
  getToken(userId?: string): Promise<string>;

  /**
   * Check if current token is valid
   *
   * @param userId - Optional user identifier for multi-user support
   * @returns True if token is valid and not expired
   */
  isTokenValid(userId?: string): Promise<boolean>;

  /**
   * Force refresh the token
   * Only applicable for OAuth flows with refresh tokens
   *
   * @param userId - Optional user identifier for multi-user support
   * @returns New access token
   */
  refreshToken(userId?: string): Promise<string>;

  /**
   * Start OAuth authorization flow (OAuth connectors only)
   * Generates authorization URL for user to visit
   *
   * @param userId - User identifier for multi-user support
   * @returns Authorization URL for user to visit
   */
  startAuthFlow?(userId?: string): Promise<string>;

  /**
   * Handle OAuth callback (OAuth connectors only)
   * Exchanges authorization code for access token
   *
   * @param callbackUrl - Full callback URL with code and state
   * @param userId - Optional user identifier (can be extracted from state)
   */
  handleCallback?(callbackUrl: string, userId?: string): Promise<void>;

  /**
   * Revoke token (if supported by connector)
   *
   * @param revocationUrl - Optional revocation endpoint
   * @param userId - Optional user identifier
   */
  revokeToken?(revocationUrl?: string, userId?: string): Promise<void>;

  /**
   * Get connector metadata (rate limits, API version, etc.)
   */
  getMetadata?(): {
    apiVersion?: string;
    rateLimit?: {
      requestsPerMinute?: number;
      requestsPerDay?: number;
    };
    documentation?: string;
  };
}
