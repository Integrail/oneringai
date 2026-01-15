/**
 * OAuthManager Unit Tests
 * Tests OAuth flow orchestration, token management, and multi-user support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setGlobalDispatcher, getGlobalDispatcher, Agent } from 'undici';
import { OAuthManager } from '@/connectors/oauth/OAuthManager.js';
import { MockOAuthServer } from '../../fixtures/mockOAuthServer.js';
import { MockTokenStorage } from '../../fixtures/mockStorage.js';
import type { OAuthConfig } from '@/connectors/oauth/types.js';

describe('OAuthManager', () => {
  let mockServer: MockOAuthServer;
  let mockStorage: MockTokenStorage;
  let originalDispatcher: any;

  const baseConfig: OAuthConfig = {
    flow: 'authorization_code',
    clientId: 'test_client_id',
    tokenUrl: 'https://oauth.example.com/token',
    authorizationUrl: 'https://oauth.example.com/authorize',
    redirectUri: 'http://localhost:3000/callback',
    scope: 'read write'
  };

  beforeEach(() => {
    mockStorage = new MockTokenStorage();
    mockServer = new MockOAuthServer({
      tokenUrl: baseConfig.tokenUrl,
      authorizationUrl: baseConfig.authorizationUrl,
      revocationUrl: 'https://oauth.example.com/revoke'
    });

    // Store original dispatcher and set mock
    originalDispatcher = getGlobalDispatcher();
    setGlobalDispatcher(mockServer.getAgent());
  });

  afterEach(() => {
    // Restore original dispatcher
    setGlobalDispatcher(originalDispatcher);
    mockStorage.clear();
    mockServer.reset();
  });

  describe('Configuration Validation', () => {
    it('should create OAuthManager with valid authorization_code config', () => {
      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      expect(manager).toBeDefined();
    });

    it('should throw on missing flow', () => {
      expect(() => {
        new OAuthManager({
          ...baseConfig,
          flow: undefined as any
        });
      }).toThrow(/flow is required/i);
    });

    it('should throw on missing tokenUrl for non-static flows', () => {
      expect(() => {
        new OAuthManager({
          ...baseConfig,
          tokenUrl: undefined as any
        });
      }).toThrow(/tokenUrl is required/i);
    });

    it('should throw on missing clientId for non-static flows', () => {
      expect(() => {
        new OAuthManager({
          ...baseConfig,
          clientId: undefined as any
        });
      }).toThrow(/clientId is required/i);
    });

    it('should throw on missing authorizationUrl for authorization_code flow', () => {
      expect(() => {
        new OAuthManager({
          ...baseConfig,
          authorizationUrl: undefined
        });
      }).toThrow(/authorizationUrl is required/i);
    });

    it('should throw on missing redirectUri for authorization_code flow', () => {
      expect(() => {
        new OAuthManager({
          ...baseConfig,
          redirectUri: undefined
        });
      }).toThrow(/redirectUri is required/i);
    });

    it('should throw on missing clientSecret for client_credentials flow', () => {
      expect(() => {
        new OAuthManager({
          flow: 'client_credentials',
          clientId: 'test',
          tokenUrl: 'https://example.com/token'
        });
      }).toThrow(/clientSecret is required/i);
    });

    it('should throw on missing privateKey for jwt_bearer flow', () => {
      expect(() => {
        new OAuthManager({
          flow: 'jwt_bearer',
          clientId: 'test',
          tokenUrl: 'https://example.com/token'
        });
      }).toThrow(/privateKey.*required/i);
    });

    it('should throw on missing staticToken for static_token flow', () => {
      expect(() => {
        new OAuthManager({
          flow: 'static_token'
        } as any);
      }).toThrow(/staticToken is required/i);
    });

    it('should create static_token flow without tokenUrl or clientId', () => {
      const manager = new OAuthManager({
        flow: 'static_token',
        staticToken: 'sk-test-token'
      } as OAuthConfig);

      expect(manager).toBeDefined();
    });
  });

  describe('Authorization Flow', () => {
    it('should generate authorization URL', async () => {
      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      const authUrl = await manager.startAuthFlow();

      expect(authUrl).toContain(baseConfig.authorizationUrl);
      expect(authUrl).toContain(`client_id=${baseConfig.clientId}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('state=');
    });

    it('should include PKCE code_challenge in authorization URL', async () => {
      const manager = new OAuthManager({
        ...baseConfig,
        usePKCE: true,
        storage: mockStorage
      });

      const authUrl = await manager.startAuthFlow();

      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
    });

    it('should embed userId in state parameter', async () => {
      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      const authUrl = await manager.startAuthFlow('user_123');

      // State should contain userId separator
      const url = new URL(authUrl);
      const state = url.searchParams.get('state');

      expect(state).toContain('::');
      expect(state).toContain('user_123');
    });

    it('should exchange code for token via handleCallback', async () => {
      mockServer.mockTokenSuccess({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600
      });

      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      // Start auth flow to get valid state
      const authUrl = await manager.startAuthFlow();
      const state = new URL(authUrl).searchParams.get('state');

      // Simulate callback with code
      const callbackUrl = `http://localhost:3000/callback?code=auth_code_123&state=${state}`;

      await manager.handleCallback(callbackUrl);

      // Token should be stored (at least one token request was made)
      expect(mockServer.getTokenRequestCount()).toBeGreaterThanOrEqual(1);
    });

    it('should throw on missing code in callback', async () => {
      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      await expect(
        manager.handleCallback('http://localhost:3000/callback?state=abc')
      ).rejects.toThrow(/missing.*code/i);
    });

    it('should throw on missing state in callback', async () => {
      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      await expect(
        manager.handleCallback('http://localhost:3000/callback?code=abc')
      ).rejects.toThrow(/missing.*state/i);
    });
  });

  describe('Token Management', () => {
    it('should return valid token', async () => {
      mockServer.mockTokenSuccess({
        access_token: 'test_access_token',
        expires_in: 3600
      });

      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      // First start auth and exchange code
      const authUrl = await manager.startAuthFlow();
      const state = new URL(authUrl).searchParams.get('state');
      await manager.handleCallback(`http://localhost:3000/callback?code=test&state=${state}`);

      // Now getToken should return the token
      const token = await manager.getToken();

      expect(token).toBe('test_access_token');
    });

    it('should trigger refresh for expired token', async () => {
      // Mock initial token that's almost expired
      mockServer.mockTokenSuccess({
        access_token: 'initial_token',
        refresh_token: 'refresh_token',
        expires_in: 1 // Expires in 1 second
      });

      mockServer.mockRefreshSuccess({
        access_token: 'refreshed_token',
        expires_in: 3600
      });

      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage,
        refreshBeforeExpiry: 300 // Refresh 5 minutes before expiry
      });

      // Get initial token
      const authUrl = await manager.startAuthFlow();
      const state = new URL(authUrl).searchParams.get('state');
      await manager.handleCallback(`http://localhost:3000/callback?code=test&state=${state}`);

      // Token should be refreshed because it expires in 1 second
      const token = await manager.getToken();

      expect(mockServer.getRefreshRequestCount()).toBeGreaterThanOrEqual(1);
    });

    it('should check token validity', async () => {
      mockServer.mockTokenSuccess({
        access_token: 'valid_token',
        expires_in: 3600
      });

      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      // Before auth
      const isValidBefore = await manager.isTokenValid();
      expect(isValidBefore).toBe(false);

      // After auth
      const authUrl = await manager.startAuthFlow();
      const state = new URL(authUrl).searchParams.get('state');
      await manager.handleCallback(`http://localhost:3000/callback?code=test&state=${state}`);

      const isValidAfter = await manager.isTokenValid();
      expect(isValidAfter).toBe(true);
    });
  });

  describe('Multi-User Support', () => {
    it('should isolate tokens between users', async () => {
      mockServer.mockTokenSuccess({ access_token: 'token_alice' }, true);

      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      // Auth for alice
      const aliceAuthUrl = await manager.startAuthFlow('alice');
      const aliceState = new URL(aliceAuthUrl).searchParams.get('state');
      await manager.handleCallback(`http://localhost:3000/callback?code=code_alice&state=${aliceState}`, 'alice');

      // Auth for bob with different token
      mockServer.mockTokenSuccess({ access_token: 'token_bob' }, true);
      const bobAuthUrl = await manager.startAuthFlow('bob');
      const bobState = new URL(bobAuthUrl).searchParams.get('state');
      await manager.handleCallback(`http://localhost:3000/callback?code=code_bob&state=${bobState}`, 'bob');

      // Tokens should be stored separately (check storage keys)
      const keys = mockStorage.getAllKeys();
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    it('should return user-specific token', async () => {
      mockServer.mockTokenSuccess({ access_token: 'user_token' }, true);

      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      // Auth for specific user
      const authUrl = await manager.startAuthFlow('user_specific');
      const state = new URL(authUrl).searchParams.get('state');
      await manager.handleCallback(`http://localhost:3000/callback?code=test&state=${state}`, 'user_specific');

      const token = await manager.getToken('user_specific');
      expect(token).toBe('user_token');
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token', async () => {
      mockServer.mockTokenSuccess({ access_token: 'revocable_token' });

      const manager = new OAuthManager({
        ...baseConfig,
        storage: mockStorage
      });

      // Get token first
      const authUrl = await manager.startAuthFlow();
      const state = new URL(authUrl).searchParams.get('state');
      await manager.handleCallback(`http://localhost:3000/callback?code=test&state=${state}`);

      // Mock revocation endpoint
      mockServer.mockRevocationSuccess();

      // Revoke
      await manager.revokeToken('https://oauth.example.com/revoke');

      // Token should be removed from storage
      const isValid = await manager.isTokenValid();
      expect(isValid).toBe(false);
    });
  });

  describe('Static Token Flow', () => {
    it('should return static token immediately', async () => {
      const manager = new OAuthManager({
        flow: 'static_token',
        staticToken: 'sk-static-api-key'
      } as OAuthConfig);

      const token = await manager.getToken();

      expect(token).toBe('sk-static-api-key');
    });

    it('should always report static token as valid', async () => {
      const manager = new OAuthManager({
        flow: 'static_token',
        staticToken: 'sk-static-api-key'
      } as OAuthConfig);

      const isValid = await manager.isTokenValid();

      expect(isValid).toBe(true);
    });
  });

  describe('Client Credentials Flow', () => {
    it('should obtain token with client credentials', async () => {
      mockServer.mockTokenSuccess({
        access_token: 'cc_access_token',
        expires_in: 3600
      });

      const manager = new OAuthManager({
        flow: 'client_credentials',
        clientId: 'service_client',
        clientSecret: 'service_secret',
        tokenUrl: baseConfig.tokenUrl,
        storage: mockStorage
      });

      const token = await manager.getToken();

      expect(token).toBe('cc_access_token');
    });
  });

  describe('Error Handling', () => {
    it('should throw when startAuthFlow called on non-auth_code flow', async () => {
      const manager = new OAuthManager({
        flow: 'static_token',
        staticToken: 'sk-test'
      } as OAuthConfig);

      await expect(manager.startAuthFlow()).rejects.toThrow(/only available.*authorization_code/i);
    });

    it('should throw when handleCallback called on non-auth_code flow', async () => {
      const manager = new OAuthManager({
        flow: 'static_token',
        staticToken: 'sk-test'
      } as OAuthConfig);

      await expect(
        manager.handleCallback('http://localhost/callback?code=x&state=y')
      ).rejects.toThrow(/only available.*authorization_code/i);
    });

    it('should throw when revokeToken called on non-auth_code flow', async () => {
      const manager = new OAuthManager({
        flow: 'static_token',
        staticToken: 'sk-test'
      } as OAuthConfig);

      await expect(manager.revokeToken()).rejects.toThrow(/not implemented/i);
    });
  });
});
