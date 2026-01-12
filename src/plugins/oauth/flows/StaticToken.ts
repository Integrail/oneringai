/**
 * Static Token Flow - For APIs that use static API keys
 * Examples: OpenAI, Anthropic, many SaaS APIs
 */

import type { OAuthConfig } from '../types.js';

export class StaticTokenFlow {
  private token: string;

  constructor(private config: OAuthConfig) {
    if (!config.staticToken) {
      throw new Error('Static token flow requires staticToken in config');
    }

    this.token = config.staticToken;
  }

  /**
   * Get token (always returns the static token)
   */
  async getToken(): Promise<string> {
    return this.token;
  }

  /**
   * Refresh token (no-op for static tokens)
   */
  async refreshToken(): Promise<string> {
    return this.token;
  }

  /**
   * Token is always valid for static tokens
   */
  async isTokenValid(): Promise<boolean> {
    return true;
  }

  /**
   * Update the static token
   */
  updateToken(newToken: string): void {
    this.token = newToken;
  }
}
