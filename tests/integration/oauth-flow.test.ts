/**
 * OAuth Flow Integration Tests
 * End-to-end tests for complete OAuth flows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import { OAuthManager } from '@/connectors/oauth/OAuthManager.js';
import { MockTokenStorage } from '../fixtures/mockStorage.js';
import { MockOAuthServer } from '../fixtures/mockOAuthServer.js';

describe('OAuth Flow Integration', () => {
  let mockStorage: MockTokenStorage;
  let mockOAuthServer: MockOAuthServer;
  let originalDispatcher: any;

  const config = {
    flow: 'authorization_code' as const,
    clientId: 'integration-test-client',
    clientSecret: 'integration-test-secret',
    authorizationUrl: 'https://oauth.example.com/authorize',
    tokenUrl: 'https://oauth.example.com/token',
    redirectUri: 'http://localhost:3000/callback',
    scope: 'read write',
    usePKCE: true,
  };

  beforeEach(() => {
    mockStorage = new MockTokenStorage();

    mockOAuthServer = new MockOAuthServer({
      tokenUrl: config.tokenUrl,
      authorizationUrl: config.authorizationUrl,
    });

    originalDispatcher = getGlobalDispatcher();
    setGlobalDispatcher(mockOAuthServer.getAgent());
  });

  afterEach(() => {
    setGlobalDispatcher(originalDispatcher);
  });

  describe('Multi-User OAuth E2E', () => {
    it('should isolate tokens for different users', async () => {
      const oauth = new OAuthManager({
        ...config,
        storage: mockStorage,
      });

      // User 1 auth flow
      const authUrl1 = await oauth.startAuthFlow('user1');
      const state1 = new URL(authUrl1).searchParams.get('state')!;

      // Reset and mock for user1
      mockOAuthServer.reset();
      mockOAuthServer.mockTokenSuccess({
        access_token: 'user1_access_token',
        refresh_token: 'user1_refresh_token'
      });
      await oauth.handleCallback(`http://localhost:3000/callback?code=code1&state=${state1}`);

      // User 2 auth flow
      const authUrl2 = await oauth.startAuthFlow('user2');
      const state2 = new URL(authUrl2).searchParams.get('state')!;

      // Reset and mock for user2
      mockOAuthServer.reset();
      mockOAuthServer.mockTokenSuccess({
        access_token: 'user2_access_token',
        refresh_token: 'user2_refresh_token'
      });
      await oauth.handleCallback(`http://localhost:3000/callback?code=code2&state=${state2}`);

      // Get tokens
      const token1 = await oauth.getToken('user1');
      const token2 = await oauth.getToken('user2');

      // Tokens should be different
      expect(token1).toBe('user1_access_token');
      expect(token2).toBe('user2_access_token');
      expect(token1).not.toBe(token2);

      // Verify separate storage
      expect(mockStorage.size()).toBe(2);
    });

    it('should handle concurrent auth flows for different users', async () => {
      const oauth = new OAuthManager({
        ...config,
        storage: mockStorage,
      });

      const users = ['alice', 'bob', 'charlie'];

      // Start all flows concurrently
      const authUrls = await Promise.all(
        users.map(user => oauth.startAuthFlow(user))
      );

      // Extract states
      const states = authUrls.map(url => new URL(url).searchParams.get('state')!);

      // Complete all callbacks
      for (let i = 0; i < users.length; i++) {
        mockOAuthServer.reset();
        mockOAuthServer.mockTokenSuccess({
          access_token: `${users[i]}_token`,
          refresh_token: `${users[i]}_refresh`
        });

        await oauth.handleCallback(
          `http://localhost:3000/callback?code=code${i}&state=${states[i]}`
        );
      }

      // All users should have different tokens
      const tokens = await Promise.all(
        users.map(user => oauth.getToken(user))
      );

      expect(new Set(tokens).size).toBe(3); // All unique
      expect(tokens[0]).toBe('alice_token');
      expect(tokens[1]).toBe('bob_token');
      expect(tokens[2]).toBe('charlie_token');
    });
  });

  describe('Token Lifecycle', () => {
    it('should complete full lifecycle: authorize → exchange → use → refresh → revoke', async () => {
      const oauth = new OAuthManager({
        ...config,
        storage: mockStorage,
      });

      // 1. Start auth flow
      const authUrl = await oauth.startAuthFlow('testuser');
      expect(authUrl).toContain('code_challenge');

      // 2. Exchange code for token
      const state = new URL(authUrl).searchParams.get('state')!;
      mockOAuthServer.reset();
      mockOAuthServer.mockTokenSuccess({
        access_token: 'initial_token',
        refresh_token: 'initial_refresh',
        expires_in: 3600
      });

      await oauth.handleCallback(`http://localhost:3000/callback?code=auth_code&state=${state}`);

      // 3. Use token
      const token1 = await oauth.getToken('testuser');
      expect(token1).toBe('initial_token');

      // 4. Simulate token expiration and refresh
      // Store expired token
      await mockStorage.storeToken(`auth_code:${config.clientId}:testuser`, {
        access_token: 'expired_token',
        refresh_token: 'initial_refresh',
        expires_in: 3600,
        obtained_at: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
        token_type: 'Bearer',
        scope: config.scope!
      });

      mockOAuthServer.reset();
      mockOAuthServer.mockRefreshSuccess({
        access_token: 'refreshed_token',
        refresh_token: 'new_refresh'
      });

      const token2 = await oauth.getToken('testuser');
      expect(token2).toBe('refreshed_token');

      // 5. Revoke token (pass userId)
      await oauth.revokeToken(undefined, 'testuser');

      // Token should be gone
      await expect(
        oauth.getToken('testuser')
      ).rejects.toThrow('No valid token available');
    });
  });
});
