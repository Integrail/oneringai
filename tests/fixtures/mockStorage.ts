/**
 * Mock Token Storage for Testing
 * Simple in-memory implementation without encryption for testing
 */

import { ITokenStorage } from '../../src/connectors/oauth/domain/ITokenStorage.js';
import { StoredToken } from '../../src/connectors/oauth/types.js';

export class MockTokenStorage implements ITokenStorage {
  private tokens = new Map<string, StoredToken>();

  async storeToken(key: string, token: StoredToken): Promise<void> {
    // Store without encryption for easier testing
    this.tokens.set(key, { ...token });
  }

  async getToken(key: string): Promise<StoredToken | null> {
    const token = this.tokens.get(key);
    return token ? { ...token } : null;
  }

  async deleteToken(key: string): Promise<void> {
    this.tokens.delete(key);
  }

  // Test helpers
  clear(): void {
    this.tokens.clear();
  }

  size(): number {
    return this.tokens.size;
  }

  has(key: string): boolean {
    return this.tokens.has(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.tokens.keys());
  }
}
