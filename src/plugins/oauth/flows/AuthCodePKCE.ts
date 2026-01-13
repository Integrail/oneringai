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
  // Store PKCE data per user
  private codeVerifiers: Map<string, string> = new Map();
  private states: Map<string, string> = new Map();

  constructor(private config: OAuthConfig) {
    const storageKey = config.storageKey || `auth_code:${config.clientId}`;
    this.tokenStore = new TokenStore(storageKey, config.storage);
  }

  /**
   * Generate authorization URL for user to visit
   * Opens browser or redirects user to this URL
   *
   * @param userId - User identifier for multi-user support (optional)
   */
  async getAuthorizationUrl(userId?: string): Promise<string> {
    if (!this.config.authorizationUrl) {
      throw new Error('authorizationUrl is required for authorization_code flow');
    }

    if (!this.config.redirectUri) {
      throw new Error('redirectUri is required for authorization_code flow');
    }

    const userKey = userId || 'default';

    // Generate PKCE pair
    const { codeVerifier, codeChallenge } = generatePKCE();
    this.codeVerifiers.set(userKey, codeVerifier);

    // Generate state for CSRF protection
    const state = generateState();
    this.states.set(userKey, state);

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
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

    // Add user_id as state metadata (encode in state for retrieval in callback)
    // The state will be: `{random_state}::{userId}`
    const stateWithUser = userId ? `${state}::${userId}` : state;
    params.set('state', stateWithUser);

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from callback
   * @param state - State parameter from callback (for CSRF verification, may include userId)
   * @param userId - User identifier (optional, can be extracted from state)
   */
  async exchangeCode(code: string, state: string, userId?: string): Promise<void> {
    // Extract userId from state if embedded
    let actualState = state;
    let actualUserId = userId;

    if (state.includes('::')) {
      const parts = state.split('::');
      actualState = parts[0]!;
      actualUserId = parts[1];
    }

    const userKey = actualUserId || 'default';

    // Verify state to prevent CSRF attacks
    const expectedState = this.states.get(userKey);
    if (actualState !== expectedState) {
      throw new Error(`State mismatch for user ${actualUserId} - possible CSRF attack. Expected: ${expectedState}, Got: ${actualState}`);
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
    const codeVerifier = this.codeVerifiers.get(userKey);
    if (this.config.usePKCE !== false && codeVerifier) {
      params.append('code_verifier', codeVerifier);
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

    // Store token (encrypted) with user scoping
    await this.tokenStore.storeToken(data, actualUserId);

    // Clear PKCE data (one-time use)
    this.codeVerifiers.delete(userKey);
    this.states.delete(userKey);
  }

  /**
   * Get valid token (auto-refreshes if needed)
   * @param userId - User identifier for multi-user support
   */
  async getToken(userId?: string): Promise<string> {
    // Return cached token if valid
    if (await this.tokenStore.isValid(this.config.refreshBeforeExpiry, userId)) {
      return this.tokenStore.getAccessToken(userId);
    }

    // Try to refresh if we have a refresh token
    if (await this.tokenStore.hasRefreshToken(userId)) {
      return this.refreshToken(userId);
    }

    // No valid token and can't refresh
    throw new Error(`No valid token available for ${userId ? `user: ${userId}` : 'default user'}. User needs to authorize (call startAuthFlow).`);
  }

  /**
   * Refresh access token using refresh token
   * @param userId - User identifier for multi-user support
   */
  async refreshToken(userId?: string): Promise<string> {
    const refreshToken = await this.tokenStore.getRefreshToken(userId);

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

    // Store new token with user scoping
    await this.tokenStore.storeToken(data, userId);

    return data.access_token;
  }

  /**
   * Check if token is valid
   * @param userId - User identifier for multi-user support
   */
  async isTokenValid(userId?: string): Promise<boolean> {
    return this.tokenStore.isValid(this.config.refreshBeforeExpiry, userId);
  }

  /**
   * Revoke token (if supported by provider)
   * @param revocationUrl - Optional revocation endpoint
   * @param userId - User identifier for multi-user support
   */
  async revokeToken(revocationUrl?: string, userId?: string): Promise<void> {
    if (!revocationUrl) {
      // Just clear from storage
      await this.tokenStore.clear(userId);
      return;
    }

    try {
      const token = await this.tokenStore.getAccessToken(userId);

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
      await this.tokenStore.clear(userId);
    }
  }
}
