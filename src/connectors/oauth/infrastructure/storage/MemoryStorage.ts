/**
 * In-memory token storage (default)
 * Tokens are encrypted in memory using AES-256-GCM
 */

import { ITokenStorage, StoredToken } from '../../domain/ITokenStorage.js';
import { encrypt, decrypt, getEncryptionKey } from '../../utils/encryption.js';

export class MemoryStorage implements ITokenStorage {
  private tokens: Map<string, string> = new Map(); // Stores encrypted tokens

  async storeToken(key: string, token: StoredToken): Promise<void> {
    const encryptionKey = getEncryptionKey();
    const plaintext = JSON.stringify(token);
    const encrypted = encrypt(plaintext, encryptionKey);

    this.tokens.set(key, encrypted);
  }

  async getToken(key: string): Promise<StoredToken | null> {
    const encrypted = this.tokens.get(key);
    if (!encrypted) {
      return null;
    }

    try {
      const encryptionKey = getEncryptionKey();
      const decrypted = decrypt(encrypted, encryptionKey);
      return JSON.parse(decrypted) as StoredToken;
    } catch (error) {
      console.error('Failed to decrypt token from memory:', error);
      // Remove corrupted token
      this.tokens.delete(key);
      return null;
    }
  }

  async deleteToken(key: string): Promise<void> {
    this.tokens.delete(key);
  }

  async hasToken(key: string): Promise<boolean> {
    return this.tokens.has(key);
  }

  /**
   * Clear all tokens (useful for testing)
   */
  clearAll(): void {
    this.tokens.clear();
  }

  /**
   * Get number of stored tokens
   */
  size(): number {
    return this.tokens.size;
  }

  /**
   * List all storage keys (for account enumeration)
   */
  async listKeys(): Promise<string[]> {
    return Array.from(this.tokens.keys());
  }
}
