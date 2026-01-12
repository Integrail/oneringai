/**
 * Token Store (Domain Layer)
 * Manages token lifecycle using pluggable storage backend
 */

import { ITokenStorage, StoredToken } from './ITokenStorage.js';
import { MemoryStorage } from '../infrastructure/storage/MemoryStorage.js';

export class TokenStore {
  private storage: ITokenStorage;
  private storageKey: string;

  constructor(storageKey: string = 'default', storage?: ITokenStorage) {
    this.storageKey = storageKey;
    // Default to in-memory storage (encrypted)
    this.storage = storage || new MemoryStorage();
  }

  /**
   * Store token (encrypted by storage layer)
   */
  async storeToken(tokenResponse: any): Promise<void> {
    const token: StoredToken = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_in: tokenResponse.expires_in || 3600,
      token_type: tokenResponse.token_type || 'Bearer',
      scope: tokenResponse.scope,
      obtained_at: Date.now(),
    };

    await this.storage.storeToken(this.storageKey, token);
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string> {
    const token = await this.storage.getToken(this.storageKey);
    if (!token) {
      throw new Error('No token stored');
    }
    return token.access_token;
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string> {
    const token = await this.storage.getToken(this.storageKey);
    if (!token?.refresh_token) {
      throw new Error('No refresh token available');
    }
    return token.refresh_token;
  }

  /**
   * Check if has refresh token
   */
  async hasRefreshToken(): Promise<boolean> {
    const token = await this.storage.getToken(this.storageKey);
    return !!token?.refresh_token;
  }

  /**
   * Check if token is valid (not expired)
   *
   * @param bufferSeconds - Refresh this many seconds before expiry (default: 300 = 5 min)
   */
  async isValid(bufferSeconds: number = 300): Promise<boolean> {
    const token = await this.storage.getToken(this.storageKey);
    if (!token) {
      return false;
    }

    const expiresAt = token.obtained_at + token.expires_in * 1000;
    const bufferMs = bufferSeconds * 1000;

    return Date.now() < expiresAt - bufferMs;
  }

  /**
   * Clear stored token
   */
  async clear(): Promise<void> {
    await this.storage.deleteToken(this.storageKey);
  }

  /**
   * Get full token info
   */
  async getTokenInfo(): Promise<StoredToken | null> {
    return this.storage.getToken(this.storageKey);
  }
}
