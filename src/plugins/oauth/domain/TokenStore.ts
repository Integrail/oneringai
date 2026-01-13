/**
 * Token Store (Domain Layer)
 * Manages token lifecycle using pluggable storage backend
 */

import { ITokenStorage, StoredToken } from './ITokenStorage.js';
import { MemoryStorage } from '../infrastructure/storage/MemoryStorage.js';

export class TokenStore {
  private storage: ITokenStorage;
  private baseStorageKey: string;

  constructor(storageKey: string = 'default', storage?: ITokenStorage) {
    this.baseStorageKey = storageKey;
    // Default to in-memory storage (encrypted)
    this.storage = storage || new MemoryStorage();
  }

  /**
   * Get user-scoped storage key
   * For multi-user support, keys are scoped per user: "provider:userId"
   * For single-user (backward compatible), userId is omitted or "default"
   *
   * @param userId - User identifier (optional, defaults to single-user mode)
   * @returns Storage key scoped to user
   */
  private getScopedKey(userId?: string): string {
    if (!userId || userId === 'default') {
      // Single-user mode (backward compatible)
      return this.baseStorageKey;
    }
    // Multi-user mode: scope by userId
    return `${this.baseStorageKey}:${userId}`;
  }

  /**
   * Store token (encrypted by storage layer)
   * @param tokenResponse - Token response from OAuth provider
   * @param userId - Optional user identifier for multi-user support
   */
  async storeToken(tokenResponse: any, userId?: string): Promise<void> {
    const token: StoredToken = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_in: tokenResponse.expires_in || 3600,
      token_type: tokenResponse.token_type || 'Bearer',
      scope: tokenResponse.scope,
      obtained_at: Date.now(),
    };

    const key = this.getScopedKey(userId);
    await this.storage.storeToken(key, token);
  }

  /**
   * Get access token
   * @param userId - Optional user identifier for multi-user support
   */
  async getAccessToken(userId?: string): Promise<string> {
    const key = this.getScopedKey(userId);
    const token = await this.storage.getToken(key);
    if (!token) {
      throw new Error(`No token stored for ${userId ? `user: ${userId}` : 'default user'}`);
    }
    return token.access_token;
  }

  /**
   * Get refresh token
   * @param userId - Optional user identifier for multi-user support
   */
  async getRefreshToken(userId?: string): Promise<string> {
    const key = this.getScopedKey(userId);
    const token = await this.storage.getToken(key);
    if (!token?.refresh_token) {
      throw new Error(`No refresh token available for ${userId ? `user: ${userId}` : 'default user'}`);
    }
    return token.refresh_token;
  }

  /**
   * Check if has refresh token
   * @param userId - Optional user identifier for multi-user support
   */
  async hasRefreshToken(userId?: string): Promise<boolean> {
    const key = this.getScopedKey(userId);
    const token = await this.storage.getToken(key);
    return !!token?.refresh_token;
  }

  /**
   * Check if token is valid (not expired)
   *
   * @param bufferSeconds - Refresh this many seconds before expiry (default: 300 = 5 min)
   * @param userId - Optional user identifier for multi-user support
   */
  async isValid(bufferSeconds: number = 300, userId?: string): Promise<boolean> {
    const key = this.getScopedKey(userId);
    const token = await this.storage.getToken(key);
    if (!token) {
      return false;
    }

    const expiresAt = token.obtained_at + token.expires_in * 1000;
    const bufferMs = bufferSeconds * 1000;

    return Date.now() < expiresAt - bufferMs;
  }

  /**
   * Clear stored token
   * @param userId - Optional user identifier for multi-user support
   */
  async clear(userId?: string): Promise<void> {
    const key = this.getScopedKey(userId);
    await this.storage.deleteToken(key);
  }

  /**
   * Get full token info
   * @param userId - Optional user identifier for multi-user support
   */
  async getTokenInfo(userId?: string): Promise<StoredToken | null> {
    const key = this.getScopedKey(userId);
    return this.storage.getToken(key);
  }
}
