/**
 * OAuth 2.0 Client Credentials Flow
 * Machine-to-machine authentication
 */

import { TokenStore } from '../domain/TokenStore.js';
import type { OAuthConfig } from '../types.js';

export class ClientCredentialsFlow {
  private tokenStore: TokenStore;

  constructor(private config: OAuthConfig) {
    const storageKey = config.storageKey || `client_credentials:${config.clientId}`;
    this.tokenStore = new TokenStore(storageKey, config.storage);
  }

  /**
   * Get token using client credentials
   * @param userId - User identifier for multi-user support (optional, rarely used for client_credentials)
   * @param accountId - Account alias for multi-account support (optional)
   */
  async getToken(userId?: string, accountId?: string): Promise<string> {
    // Return cached token if valid
    if (await this.tokenStore.isValid(this.config.refreshBeforeExpiry, userId, accountId)) {
      return this.tokenStore.getAccessToken(userId, accountId);
    }

    // Request new token
    return this.requestToken(userId, accountId);
  }

  /**
   * Request a new token from the authorization server
   */
  private async requestToken(userId?: string, accountId?: string): Promise<string> {
    // Create Basic Auth header
    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64'
    );

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
    });

    // Add scope if provided
    if (this.config.scope) {
      params.append('scope', this.config.scope);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data: any = await response.json();

    // Store token (encrypted)
    await this.tokenStore.storeToken(data, userId, accountId);

    return data.access_token;
  }

  /**
   * Refresh token (client credentials don't use refresh tokens)
   * Just requests a new token
   * @param userId - User identifier for multi-user support (optional)
   * @param accountId - Account alias for multi-account support (optional)
   */
  async refreshToken(userId?: string, accountId?: string): Promise<string> {
    await this.tokenStore.clear(userId, accountId);
    return this.requestToken(userId, accountId);
  }

  /**
   * Check if token is valid
   * @param userId - User identifier for multi-user support (optional)
   * @param accountId - Account alias for multi-account support (optional)
   */
  async isTokenValid(userId?: string, accountId?: string): Promise<boolean> {
    return this.tokenStore.isValid(this.config.refreshBeforeExpiry, userId, accountId);
  }
}
