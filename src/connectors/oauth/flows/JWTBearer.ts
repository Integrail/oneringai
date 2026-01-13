/**
 * OAuth 2.0 JWT Bearer Flow (RFC 7523)
 * Service account authentication using private key signing
 */

import { SignJWT, importPKCS8 } from 'jose';
import * as fs from 'fs';
import { TokenStore } from '../domain/TokenStore.js';
import type { OAuthConfig } from '../types.js';

export class JWTBearerFlow {
  private tokenStore: TokenStore;
  private privateKey: string;

  constructor(private config: OAuthConfig) {
    const storageKey = config.storageKey || `jwt_bearer:${config.clientId}`;
    this.tokenStore = new TokenStore(storageKey, config.storage);

    // Load private key
    if (config.privateKey) {
      this.privateKey = config.privateKey;
    } else if (config.privateKeyPath) {
      try {
        this.privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
      } catch (error) {
        throw new Error(`Failed to read private key from ${config.privateKeyPath}: ${(error as Error).message}`);
      }
    } else {
      throw new Error('JWT Bearer flow requires privateKey or privateKeyPath');
    }
  }

  /**
   * Generate signed JWT assertion
   */
  private async generateJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const alg = this.config.tokenSigningAlg || 'RS256';

    // Parse private key
    const key = await importPKCS8(this.privateKey, alg);

    // Create JWT
    const jwt = await new SignJWT({
      scope: this.config.scope || '',
    })
      .setProtectedHeader({ alg })
      .setIssuer(this.config.clientId)
      .setSubject(this.config.clientId)
      .setAudience(this.config.audience || this.config.tokenUrl)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600) // 1 hour
      .sign(key);

    return jwt;
  }

  /**
   * Get token using JWT Bearer assertion
   */
  async getToken(): Promise<string> {
    // Return cached token if valid
    if (await this.tokenStore.isValid(this.config.refreshBeforeExpiry)) {
      return this.tokenStore.getAccessToken();
    }

    // Request new token
    return this.requestToken();
  }

  /**
   * Request token using JWT assertion
   */
  private async requestToken(): Promise<string> {
    // Generate JWT assertion
    const assertion = await this.generateJWT();

    // Exchange JWT for access token
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`JWT Bearer token request failed: ${response.status} ${response.statusText} - ${error}`);
    }

    const data: any = await response.json();

    // Store token (encrypted)
    await this.tokenStore.storeToken(data);

    return data.access_token;
  }

  /**
   * Refresh token (generate new JWT and request new token)
   */
  async refreshToken(): Promise<string> {
    await this.tokenStore.clear();
    return this.requestToken();
  }

  /**
   * Check if token is valid
   */
  async isTokenValid(): Promise<boolean> {
    return this.tokenStore.isValid(this.config.refreshBeforeExpiry);
  }
}
