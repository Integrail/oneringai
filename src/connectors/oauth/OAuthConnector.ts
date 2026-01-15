/**
 * OAuthConnector - Concrete implementation of IConnector
 * Wraps OAuthManager to provide the IConnector interface
 */

import { IConnector } from '../../domain/interfaces/IConnector.js';
import { ConnectorConfig } from '../../domain/entities/Connector.js';
import { OAuthManager } from './OAuthManager.js';

/**
 * Connector implementation using OAuth 2.0 for authentication
 */
export class OAuthConnector implements IConnector {
  constructor(
    public readonly name: string,
    public readonly config: ConnectorConfig,
    private readonly oauthManager: OAuthManager
  ) {}

  get displayName(): string {
    return this.config.displayName || this.name;
  }

  get baseURL(): string {
    return this.config.baseURL || '';
  }

  async getToken(userId?: string): Promise<string> {
    return this.oauthManager.getToken(userId);
  }

  async isTokenValid(userId?: string): Promise<boolean> {
    return this.oauthManager.isTokenValid(userId);
  }

  async refreshToken(userId?: string): Promise<string> {
    return this.oauthManager.refreshToken(userId);
  }

  async startAuthFlow(userId?: string): Promise<string> {
    return this.oauthManager.startAuthFlow(userId);
  }

  async handleCallback(callbackUrl: string, userId?: string): Promise<void> {
    return this.oauthManager.handleCallback(callbackUrl, userId);
  }

  async revokeToken(revocationUrl?: string, userId?: string): Promise<void> {
    return this.oauthManager.revokeToken(revocationUrl, userId);
  }

  getMetadata() {
    return {
      apiVersion: this.config.apiVersion,
      rateLimit: this.config.rateLimit,
      documentation: this.config.documentation,
    };
  }
}
