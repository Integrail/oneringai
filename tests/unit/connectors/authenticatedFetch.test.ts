/**
 * authenticatedFetch Unit Tests
 * Tests authenticated fetch with OAuth token injection and multi-user support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setGlobalDispatcher, getGlobalDispatcher, MockAgent, MockPool } from 'undici';
import { authenticatedFetch, createAuthenticatedFetch } from '@/connectors/authenticatedFetch.js';
import { ConnectorRegistry } from '@/connectors/ConnectorRegistry.js';
import type { ConnectorConfig } from '@/domain/entities/Connector.js';

describe('authenticatedFetch', () => {
  let registry: ConnectorRegistry;
  let mockAgent: MockAgent;
  let mockPool: MockPool;
  let originalDispatcher: any;

  beforeEach(() => {
    registry = ConnectorRegistry.getInstance();
    registry.clear();

    // Set up mock HTTP
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    mockPool = mockAgent.get('https://api.example.com');

    originalDispatcher = getGlobalDispatcher();
    setGlobalDispatcher(mockAgent);

    // Register a test connector with static token (for simplicity)
    registry.register('test_api', {
      displayName: 'Test API',
      description: 'Test API for testing',
      baseURL: 'https://api.example.com',
      auth: {
        type: 'api_key',
        apiKey: 'test-token-123'
      }
    });
  });

  afterEach(() => {
    registry.clear();
    setGlobalDispatcher(originalDispatcher);
  });

  describe('authenticatedFetch()', () => {
    it('should add Authorization header with bearer token', async () => {
      let capturedHeaders: Record<string, string> = {};

      mockPool
        .intercept({
          path: '/users',
          method: 'GET',
          headers: (headers) => {
            capturedHeaders = headers as Record<string, string>;
            return true;
          }
        })
        .reply(200, { users: [] });

      await authenticatedFetch(
        'https://api.example.com/users',
        { method: 'GET' },
        'test_api'
      );

      expect(capturedHeaders.authorization).toBe('Bearer test-token-123');
    });

    it('should preserve original request headers', async () => {
      let capturedHeaders: Record<string, string> = {};

      mockPool
        .intercept({
          path: '/users',
          method: 'POST',
          headers: (headers) => {
            capturedHeaders = headers as Record<string, string>;
            return true;
          }
        })
        .reply(201, { id: 1 });

      await authenticatedFetch(
        'https://api.example.com/users',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value'
          },
          body: JSON.stringify({ name: 'Test' })
        },
        'test_api'
      );

      expect(capturedHeaders['content-type']).toBe('application/json');
      expect(capturedHeaders['x-custom-header']).toBe('custom-value');
      expect(capturedHeaders.authorization).toBe('Bearer test-token-123');
    });

    it('should return fetch response', async () => {
      mockPool
        .intercept({
          path: '/data',
          method: 'GET'
        })
        .reply(200, { message: 'success' }, {
          headers: { 'content-type': 'application/json' }
        });

      const response = await authenticatedFetch(
        'https://api.example.com/data',
        { method: 'GET' },
        'test_api'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('success');
    });

    it('should throw when connector not found', async () => {
      await expect(
        authenticatedFetch(
          'https://api.example.com/data',
          { method: 'GET' },
          'nonexistent_api'
        )
      ).rejects.toThrow(/not found/i);
    });

    it('should handle URL object', async () => {
      mockPool
        .intercept({
          path: '/items',
          method: 'GET'
        })
        .reply(200, []);

      const url = new URL('https://api.example.com/items');

      const response = await authenticatedFetch(
        url,
        { method: 'GET' },
        'test_api'
      );

      expect(response.status).toBe(200);
    });

    it('should handle undefined options', async () => {
      mockPool
        .intercept({
          path: '/default',
          method: 'GET'
        })
        .reply(200, {});

      const response = await authenticatedFetch(
        'https://api.example.com/default',
        undefined,
        'test_api'
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Multi-User Support', () => {
    beforeEach(() => {
      // Register a connector that simulates multi-user (using static token for simplicity)
      // In real scenarios, different users would have different tokens
      registry.register('multi_user_api', {
        displayName: 'Multi-User API',
        description: 'Supports multiple users',
        baseURL: 'https://api.example.com',
        auth: {
          type: 'api_key',
          apiKey: 'user-agnostic-token' // In reality, this would be user-specific
        }
      });
    });

    it('should accept userId parameter', async () => {
      mockPool
        .intercept({
          path: '/user/profile',
          method: 'GET'
        })
        .reply(200, { username: 'alice' });

      // This won't actually use different tokens with api_key auth,
      // but it tests that the userId parameter is accepted
      const response = await authenticatedFetch(
        'https://api.example.com/user/profile',
        { method: 'GET' },
        'multi_user_api',
        'alice_123'
      );

      expect(response.status).toBe(200);
    });

    it('should work without userId (single-user mode)', async () => {
      mockPool
        .intercept({
          path: '/user/profile',
          method: 'GET'
        })
        .reply(200, { username: 'default' });

      const response = await authenticatedFetch(
        'https://api.example.com/user/profile',
        { method: 'GET' },
        'multi_user_api'
      );

      expect(response.status).toBe(200);
    });
  });

  describe('createAuthenticatedFetch()', () => {
    it('should create a bound fetch function', async () => {
      mockPool
        .intercept({
          path: '/bound',
          method: 'GET'
        })
        .reply(200, { bound: true });

      const boundFetch = createAuthenticatedFetch('test_api');

      const response = await boundFetch('https://api.example.com/bound');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.bound).toBe(true);
    });

    it('should validate provider at creation time', () => {
      expect(() => {
        createAuthenticatedFetch('nonexistent_api');
      }).toThrow(/not found/i);
    });

    it('should create multiple independent fetch functions', async () => {
      // Register second connector
      registry.register('other_api', {
        displayName: 'Other API',
        description: 'Another API',
        baseURL: 'https://api.other.com',
        auth: {
          type: 'api_key',
          apiKey: 'other-token'
        }
      });

      const otherPool = mockAgent.get('https://api.other.com');
      otherPool
        .intercept({ path: '/data', method: 'GET' })
        .reply(200, { source: 'other' });

      mockPool
        .intercept({ path: '/data', method: 'GET' })
        .reply(200, { source: 'test' });

      const testFetch = createAuthenticatedFetch('test_api');
      const otherFetch = createAuthenticatedFetch('other_api');

      const testResponse = await testFetch('https://api.example.com/data');
      const otherResponse = await otherFetch('https://api.other.com/data');

      expect((await testResponse.json()).source).toBe('test');
      expect((await otherResponse.json()).source).toBe('other');
    });

    it('should allow binding to userId', async () => {
      mockPool
        .intercept({
          path: '/user/data',
          method: 'GET'
        })
        .reply(200, { user: 'alice' });

      const aliceFetch = createAuthenticatedFetch('test_api', 'alice_123');

      const response = await aliceFetch('https://api.example.com/user/data');

      expect(response.status).toBe(200);
    });

    it('should pass through request options', async () => {
      let capturedMethod = '';

      mockPool
        .intercept({
          path: '/create',
          method: 'POST',
          headers: (headers) => {
            return true;
          },
          body: (body) => {
            return true;
          }
        })
        .reply(201, { created: true });

      const boundFetch = createAuthenticatedFetch('test_api');

      const response = await boundFetch('https://api.example.com/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' })
      });

      expect(response.status).toBe(201);
    });
  });

  describe('Error Handling', () => {
    it('should propagate HTTP errors', async () => {
      mockPool
        .intercept({
          path: '/error',
          method: 'GET'
        })
        .reply(500, { error: 'Internal Server Error' });

      const response = await authenticatedFetch(
        'https://api.example.com/error',
        { method: 'GET' },
        'test_api'
      );

      expect(response.status).toBe(500);
      expect(response.ok).toBe(false);
    });

    it('should propagate 401 errors (for retry logic)', async () => {
      mockPool
        .intercept({
          path: '/protected',
          method: 'GET'
        })
        .reply(401, { error: 'Unauthorized' });

      const response = await authenticatedFetch(
        'https://api.example.com/protected',
        { method: 'GET' },
        'test_api'
      );

      expect(response.status).toBe(401);
    });

    it('should propagate network errors', async () => {
      mockPool
        .intercept({
          path: '/network-fail',
          method: 'GET'
        })
        .replyWithError(new Error('Network error'));

      await expect(
        authenticatedFetch(
          'https://api.example.com/network-fail',
          { method: 'GET' },
          'test_api'
        )
      ).rejects.toThrow(); // Network errors are wrapped by fetch
    });
  });
});
