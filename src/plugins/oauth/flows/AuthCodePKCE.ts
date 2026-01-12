/**
 * OAuth 2.0 Authorization Code Flow with PKCE (RFC 7636)
 * User authentication for web and mobile apps
 */

import * as crypto from 'crypto';
import { TokenStore } from '../domain/TokenStore.js';
import { generatePKCE, generateState } from '../utils/pkce.js';
import type { OAuthConfig } from '../types.js';

export class AuthCodePKCEFlow {
  private tokenStore: TokenStore;
  private codeVerifier?: string;
  private state?: string;

  constructor(private config: OAuthConfig) {
    const storageKey = config.storageKey || `auth_code:${config.clientId}`;
    this.tokenStore = new TokenStore(storageKey, config.storage);
  }

  /**
   * Generate authorization URL for user to visit
   * Opens browser or redirects user to this URL
   */
  async getAuthorizationUrl(): Promise<string> {
    if (!this.config.authorizationUrl) {
      throw new Error('authorizationUrl is required for authorization_code flow');
    }

    if (!this.config.redirectUri) {
      throw new Error('redirectUri is required for authorization_code flow');
    }

    // Generate PKCE pair
    const { codeVerifier, codeChallenge } = generatePKCE();
    this.codeVerifier = codeVerifier;

    // Generate state for CSRF protection
    this.state = generateState();

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state: this.state,
    });

    // Add scope if provided
    if (this.config.scope) {
      params.append('scope', this.config.scope);
    }

    // Add PKCE parameters (if enabled, default true)
    if (this.config.usePKCE !== false) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from callback
   * @param state - State parameter from callback (for CSRF verification)
   */
  async exchangeCode(code: string, state: string): Promise<void> {
    // Verify state to prevent CSRF attacks
    if (state !== this.state) {
      throw new Error('State mismatch - possible CSRF attack. Expected: ' + this.state + ', Got: ' + state);
    }

    if (!this.config.redirectUri) {
      throw new Error('redirectUri is required');
    }

    // Build token request
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
    });

    // Add client secret if provided (confidential clients)
    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    // Add code_verifier if PKCE was used
    if (this.config.usePKCE !== false && this.codeVerifier) {
      params.append('code_verifier', this.codeVerifier);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data: any = await response.json();

    // Store token (encrypted)
    await this.tokenStore.storeToken(data);

    // Clear PKCE data (one-time use)
    this.codeVerifier = undefined;
    this.state = undefined;
  }

  /**
   * Get valid token (auto-refreshes if needed)
   */
  async getToken(): Promise<string> {
    // Return cached token if valid
    if (await this.tokenStore.isValid(this.config.refreshBeforeExpiry)) {
      return this.tokenStore.getAccessToken();
    }

    // Try to refresh if we have a refresh token
    if (await this.tokenStore.hasRefreshToken()) {
      return this.refreshToken();
    }

    // No valid token and can't refresh
    throw new Error('No valid token available. User needs to authorize (call startAuthFlow).');
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<string> {
    const refreshToken = await this.tokenStore.getRefreshToken();

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    // Add client secret if provided
    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data: any = await response.json();

    // Store new token
    await this.tokenStore.storeToken(data);

    return data.access_token;
  }

  /**
   * Check if token is valid
   */
  async isTokenValid(): Promise<boolean> {
    return this.tokenStore.isValid(this.config.refreshBeforeExpiry);
  }

  /**
   * Revoke token (if supported by provider)
   */
  async revokeToken(revocationUrl?: string): Promise<void> {
    if (!revocationUrl) {
      // Just clear from storage
      await this.tokenStore.clear();
      return;
    }

    try {
      const token = await this.tokenStore.getAccessToken();

      await fetch(revocationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token,
          client_id: this.config.clientId,
        }),
      });
    } finally {
      // Always clear from storage
      await this.tokenStore.clear();
    }
  }
}
