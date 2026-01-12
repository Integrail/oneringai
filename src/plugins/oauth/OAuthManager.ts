/**
 * OAuth Manager - Main entry point for OAuth 2.0 authentication
 * Supports multiple flows: Authorization Code (with PKCE), Client Credentials, JWT Bearer
 */

import { AuthCodePKCEFlow } from './flows/AuthCodePKCE.js';
import { ClientCredentialsFlow } from './flows/ClientCredentials.js';
import { JWTBearerFlow } from './flows/JWTBearer.js';
import type { OAuthConfig } from './types.js';

export class OAuthManager {
  private flow: AuthCodePKCEFlow | ClientCredentialsFlow | JWTBearerFlow;

  constructor(config: OAuthConfig) {
    // Validate configuration
    this.validateConfig(config);

    // Create appropriate flow implementation
    switch (config.flow) {
      case 'authorization_code':
        this.flow = new AuthCodePKCEFlow(config);
        break;

      case 'client_credentials':
        this.flow = new ClientCredentialsFlow(config);
        break;

      case 'jwt_bearer':
        this.flow = new JWTBearerFlow(config);
        break;

      default:
        throw new Error(`Unknown OAuth flow: ${(config as any).flow}`);
    }
  }

  /**
   * Get valid access token
   * Automatically refreshes if expired
   */
  async getToken(): Promise<string> {
    return this.flow.getToken();
  }

  /**
   * Force refresh the token
   */
  async refreshToken(): Promise<string> {
    return this.flow.refreshToken();
  }

  /**
   * Check if current token is valid
   */
  async isTokenValid(): Promise<boolean> {
    return this.flow.isTokenValid();
  }

  // ==================== Authorization Code Flow Methods ====================

  /**
   * Start authorization flow (Authorization Code only)
   * Returns URL for user to visit
   */
  async startAuthFlow(): Promise<string> {
    if (!(this.flow instanceof AuthCodePKCEFlow)) {
      throw new Error('startAuthFlow() is only available for authorization_code flow');
    }

    return this.flow.getAuthorizationUrl();
  }

  /**
   * Handle OAuth callback (Authorization Code only)
   * Call this with the callback URL after user authorizes
   */
  async handleCallback(callbackUrl: string): Promise<void> {
    if (!(this.flow instanceof AuthCodePKCEFlow)) {
      throw new Error('handleCallback() is only available for authorization_code flow');
    }

    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      throw new Error('Missing authorization code in callback URL');
    }

    if (!state) {
      throw new Error('Missing state parameter in callback URL');
    }

    await this.flow.exchangeCode(code, state);
  }

  /**
   * Revoke token (if supported by provider)
   */
  async revokeToken(revocationUrl?: string): Promise<void> {
    if (this.flow instanceof AuthCodePKCEFlow) {
      await this.flow.revokeToken(revocationUrl);
    } else {
      throw new Error('Token revocation not implemented for this flow');
    }
  }

  // ==================== Validation ====================

  private validateConfig(config: OAuthConfig): void {
    // Required fields
    if (!config.flow) {
      throw new Error('OAuth flow is required (authorization_code, client_credentials, or jwt_bearer)');
    }

    if (!config.tokenUrl) {
      throw new Error('tokenUrl is required');
    }

    if (!config.clientId) {
      throw new Error('clientId is required');
    }

    // Flow-specific validation
    switch (config.flow) {
      case 'authorization_code':
        if (!config.authorizationUrl) {
          throw new Error('authorizationUrl is required for authorization_code flow');
        }
        if (!config.redirectUri) {
          throw new Error('redirectUri is required for authorization_code flow');
        }
        break;

      case 'client_credentials':
        if (!config.clientSecret) {
          throw new Error('clientSecret is required for client_credentials flow');
        }
        break;

      case 'jwt_bearer':
        if (!config.privateKey && !config.privateKeyPath) {
          throw new Error(
            'privateKey or privateKeyPath is required for jwt_bearer flow'
          );
        }
        break;
    }

    // Warn if using FileStorage without encryption key
    if (config.storage && !process.env.OAUTH_ENCRYPTION_KEY) {
      console.warn(
        'WARNING: Using persistent storage without OAUTH_ENCRYPTION_KEY environment variable. ' +
          'Tokens will be encrypted with auto-generated key that changes on restart!'
      );
    }
  }
}
