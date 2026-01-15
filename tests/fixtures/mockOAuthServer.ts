/**
 * Mock OAuth Server for Testing
 * Uses Undici MockAgent to intercept fetch calls
 */

import { MockAgent, MockPool } from 'undici';

export interface MockOAuthServerConfig {
  tokenUrl: string;
  authorizationUrl?: string;
  revocationUrl?: string;
}

export interface MockTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export class MockOAuthServer {
  private mockAgent: MockAgent;
  private pool: MockPool;
  private tokenRequestCount = 0;
  private refreshRequestCount = 0;
  private revokeRequestCount = 0;

  constructor(private config: MockOAuthServerConfig) {
    this.mockAgent = new MockAgent();
    this.mockAgent.disableNetConnect();

    const origin = new URL(config.tokenUrl).origin;
    this.pool = this.mockAgent.get(origin);
  }

  /**
   * Mock successful token response
   */
  mockTokenSuccess(response?: Partial<MockTokenResponse>, persist: boolean = false): void {
    const tokenPath = new URL(this.config.tokenUrl).pathname;

    const interceptor = this.pool
      .intercept({
        path: tokenPath,
        method: 'POST',
        body: (body: string) => {
          this.tokenRequestCount++;
          return true;
        },
      })
      .reply(200, {
        access_token: response?.access_token || 'mock_access_token',
        refresh_token: response?.refresh_token || 'mock_refresh_token',
        expires_in: response?.expires_in || 3600,
        token_type: response?.token_type || 'Bearer',
        scope: response?.scope,
      });

    if (persist) {
      interceptor.persist(); // Only persist if requested
    }
  }

  /**
   * Mock token request failure
   */
  mockTokenError(status: number = 400, error: any = { error: 'invalid_grant' }): void {
    const tokenPath = new URL(this.config.tokenUrl).pathname;

    this.pool
      .intercept({
        path: tokenPath,
        method: 'POST',
      })
      .reply(status, error);
  }

  /**
   * Mock refresh token response
   */
  mockRefreshSuccess(response?: Partial<MockTokenResponse>): void {
    const tokenPath = new URL(this.config.tokenUrl).pathname;

    this.pool
      .intercept({
        path: tokenPath,
        method: 'POST',
        body: (body: string) => {
          if (body.includes('grant_type=refresh_token')) {
            this.refreshRequestCount++;
            return true;
          }
          return false;
        },
      })
      .reply(200, {
        access_token: response?.access_token || 'refreshed_access_token',
        refresh_token: response?.refresh_token || 'new_refresh_token',
        expires_in: response?.expires_in || 3600,
        token_type: response?.token_type || 'Bearer',
      })
      .persist(); // Allow multiple refresh requests
  }

  /**
   * Mock revocation endpoint
   */
  mockRevocationSuccess(): void {
    if (!this.config.revocationUrl) return;

    const revokePath = new URL(this.config.revocationUrl).pathname;

    this.pool
      .intercept({
        path: revokePath,
        method: 'POST',
      })
      .reply(200, {});
  }

  /**
   * Get mock agent to set as global dispatcher
   */
  getAgent(): MockAgent {
    return this.mockAgent;
  }

  /**
   * Get request counts for verification
   */
  getTokenRequestCount(): number {
    return this.tokenRequestCount;
  }

  getRefreshRequestCount(): number {
    return this.refreshRequestCount;
  }

  getRevokeRequestCount(): number {
    return this.revokeRequestCount;
  }

  /**
   * Reset counters
   */
  reset(): void {
    this.tokenRequestCount = 0;
    this.refreshRequestCount = 0;
    this.revokeRequestCount = 0;
  }
}
