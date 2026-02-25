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
   * Get user-scoped (and optionally account-scoped) storage key
   *
   * Key format (backward compatible):
   * - No userId, no accountId  → baseKey
   * - userId only              → baseKey:userId
   * - userId + accountId       → baseKey:userId:accountId
   * - accountId only           → baseKey:default:accountId
   *
   * @param userId - User identifier (optional, defaults to single-user mode)
   * @param accountId - Account alias for multi-account support (optional)
   * @returns Storage key scoped to user and account
   */
  private getScopedKey(userId?: string, accountId?: string): string {
    if (accountId) {
      // Multi-account mode: always include userId dimension
      const userPart = userId && userId !== 'default' ? userId : 'default';
      return `${this.baseStorageKey}:${userPart}:${accountId}`;
    }
    if (!userId || userId === 'default') {
      // Single-user mode (backward compatible)
      return this.baseStorageKey;
    }
    // Multi-user mode, no account (backward compatible)
    return `${this.baseStorageKey}:${userId}`;
  }

  /**
   * Store token (encrypted by storage layer)
   * @param tokenResponse - Token response from OAuth provider
   * @param userId - Optional user identifier for multi-user support
   * @param accountId - Optional account alias for multi-account support
   */
  async storeToken(tokenResponse: any, userId?: string, accountId?: string): Promise<void> {
    // Validate required fields
    if (!tokenResponse.access_token) {
      throw new Error('OAuth response missing required access_token field');
    }

    if (typeof tokenResponse.access_token !== 'string') {
      throw new Error('access_token must be a string');
    }

    if (tokenResponse.expires_in !== undefined && tokenResponse.expires_in < 0) {
      throw new Error('expires_in must be positive');
    }

    const token: StoredToken = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_in: tokenResponse.expires_in || 3600,
      token_type: tokenResponse.token_type || 'Bearer',
      scope: tokenResponse.scope,
      obtained_at: Date.now(),
    };

    const key = this.getScopedKey(userId, accountId);
    await this.storage.storeToken(key, token);
  }

  /**
   * Get access token
   * @param userId - Optional user identifier for multi-user support
   * @param accountId - Optional account alias for multi-account support
   */
  async getAccessToken(userId?: string, accountId?: string): Promise<string> {
    const key = this.getScopedKey(userId, accountId);
    const token = await this.storage.getToken(key);
    if (!token) {
      const userLabel = userId ? `user: ${userId}` : 'default user';
      const accountLabel = accountId ? `, account: ${accountId}` : '';
      throw new Error(`No token stored for ${userLabel}${accountLabel}`);
    }
    return token.access_token;
  }

  /**
   * Get refresh token
   * @param userId - Optional user identifier for multi-user support
   * @param accountId - Optional account alias for multi-account support
   */
  async getRefreshToken(userId?: string, accountId?: string): Promise<string> {
    const key = this.getScopedKey(userId, accountId);
    const token = await this.storage.getToken(key);
    if (!token?.refresh_token) {
      const userLabel = userId ? `user: ${userId}` : 'default user';
      const accountLabel = accountId ? `, account: ${accountId}` : '';
      throw new Error(`No refresh token available for ${userLabel}${accountLabel}`);
    }
    return token.refresh_token;
  }

  /**
   * Check if has refresh token
   * @param userId - Optional user identifier for multi-user support
   * @param accountId - Optional account alias for multi-account support
   */
  async hasRefreshToken(userId?: string, accountId?: string): Promise<boolean> {
    const key = this.getScopedKey(userId, accountId);
    const token = await this.storage.getToken(key);
    return !!token?.refresh_token;
  }

  /**
   * Check if token is valid (not expired)
   *
   * @param bufferSeconds - Refresh this many seconds before expiry (default: 300 = 5 min)
   * @param userId - Optional user identifier for multi-user support
   * @param accountId - Optional account alias for multi-account support
   */
  async isValid(bufferSeconds: number = 300, userId?: string, accountId?: string): Promise<boolean> {
    const key = this.getScopedKey(userId, accountId);
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
   * @param accountId - Optional account alias for multi-account support
   */
  async clear(userId?: string, accountId?: string): Promise<void> {
    const key = this.getScopedKey(userId, accountId);
    await this.storage.deleteToken(key);
  }

  /**
   * Get full token info
   * @param userId - Optional user identifier for multi-user support
   * @param accountId - Optional account alias for multi-account support
   */
  async getTokenInfo(userId?: string, accountId?: string): Promise<StoredToken | null> {
    const key = this.getScopedKey(userId, accountId);
    return this.storage.getToken(key);
  }

  /**
   * List account aliases for a user on this connector.
   * Returns account IDs that have stored tokens.
   *
   * @param userId - Optional user identifier
   * @returns Array of account aliases (e.g., ['work', 'personal'])
   */
  async listAccounts(userId?: string): Promise<string[]> {
    if (!this.storage.listKeys) {
      return [];
    }

    const allKeys = await this.storage.listKeys();
    const userPart = userId && userId !== 'default' ? userId : 'default';
    const prefix = `${this.baseStorageKey}:${userPart}:`;

    const accounts: string[] = [];
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        const accountId = key.slice(prefix.length);
        // Only include if it's a direct account (no further colons)
        if (accountId && !accountId.includes(':')) {
          accounts.push(accountId);
        }
      }
    }

    return accounts;
  }
}
