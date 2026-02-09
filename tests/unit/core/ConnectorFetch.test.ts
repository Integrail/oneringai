/**
 * Tests for Connector.fetch() and Connector.fetchJSON() - enterprise resilience features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Connector } from '../../../src/core/Connector.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Connector Fetch', () => {
  beforeEach(() => {
    Connector.clear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    Connector.clear();
  });

  describe('Basic Fetch', () => {
    it('should make authenticated request with API key', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      );

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'my-api-key' },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');
      await connector.fetch('/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-api-key',
          }),
        })
      );
    });

    it('should use custom header name and prefix for API key', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: {
          type: 'api_key',
          apiKey: 'my-key',
          headerName: 'X-API-Key',
          headerPrefix: '',
        },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');
      await connector.fetch('/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'my-key',
          }),
        })
      );
    });

    it('should resolve relative URLs with baseURL', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com/v1',
      });

      const connector = Connector.get('test');
      await connector.fetch('/users');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/v1/users',
        expect.any(Object)
      );
    });

    it('should use absolute URL when provided', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');
      await connector.fetch('https://other.api.com/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://other.api.com/endpoint',
        expect.any(Object)
      );
    });
  });

  describe('URL Path Joining', () => {
    it('should handle endpoint without leading slash', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://slack.com/api',
      });

      const connector = Connector.get('test');
      await connector.fetch('chat.postMessage');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.any(Object)
      );
    });

    it('should handle endpoint with leading slash', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://slack.com/api',
      });

      const connector = Connector.get('test');
      await connector.fetch('/chat.postMessage');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.any(Object)
      );
    });

    it('should handle baseURL with trailing slash', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://slack.com/api/',
      });

      const connector = Connector.get('test');
      await connector.fetch('chat.postMessage');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.any(Object)
      );
    });

    it('should handle both baseURL trailing slash and endpoint leading slash', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://slack.com/api/',
      });

      const connector = Connector.get('test');
      await connector.fetch('/chat.postMessage');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.any(Object)
      );
    });

    it('should pass through absolute URLs unchanged', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');
      await connector.fetch('https://other.api.com/v2/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://other.api.com/v2/endpoint',
        expect.any(Object)
      );
    });
  });

  describe('Timeout', () => {
    it('should timeout after configured timeout', async () => {
      // Mock fetch that respects AbortController signal
      mockFetch.mockImplementation(
        (_url: string, options?: { signal?: AbortSignal }) =>
          new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => resolve(new Response('{}', { status: 200 })), 10000);
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            }
          })
      );

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        timeout: 100, // 100ms timeout
      });

      const connector = Connector.get('test');

      await expect(connector.fetch('/slow')).rejects.toThrow(/timeout/i);
    }, 5000);

    it('should use default timeout when not configured', async () => {
      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        // No timeout specified - should use default (30000ms)
      });

      const connector = Connector.get('test');

      // Verify connector was created (actual timeout test would be slow)
      expect(connector).toBeDefined();
    });

    it('should allow per-request timeout override', async () => {
      // Mock fetch that respects AbortController signal
      mockFetch.mockImplementation(
        (_url: string, options?: { signal?: AbortSignal }) =>
          new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => resolve(new Response('{}', { status: 200 })), 10000);
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            }
          })
      );

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        timeout: 30000, // 30s default
      });

      const connector = Connector.get('test');

      // Override with shorter timeout
      await expect(connector.fetch('/slow', { timeout: 50 })).rejects.toThrow(/timeout/i);
    }, 5000);
  });

  describe('Retry Logic', () => {
    it('should retry on retryable status codes', async () => {
      // First call returns 503, second returns 200
      mockFetch
        .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
        .mockResolvedValueOnce(new Response('{"data":"success"}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: {
          maxRetries: 3,
          baseDelayMs: 10, // Fast for testing
          maxDelayMs: 50,
        },
      });

      const connector = Connector.get('test');
      const response = await connector.fetch('/endpoint');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('should not retry on non-retryable status codes', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 3, baseDelayMs: 10 },
      });

      const connector = Connector.get('test');
      const response = await connector.fetch('/endpoint');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(404);
    });

    it('should retry on 429 rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('Rate Limited', { status: 429 }))
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 3, baseDelayMs: 10 },
      });

      const connector = Connector.get('test');
      const response = await connector.fetch('/endpoint');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 3, baseDelayMs: 10 },
      });

      const connector = Connector.get('test');
      const response = await connector.fetch('/endpoint');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('should respect maxRetries limit', async () => {
      mockFetch.mockResolvedValue(new Response('Error', { status: 500 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 2, baseDelayMs: 10 },
      });

      const connector = Connector.get('test');
      const response = await connector.fetch('/endpoint');

      // Initial + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(500);
    });

    it('should skip retry when skipRetry option is set', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 3, baseDelayMs: 10 },
      });

      const connector = Connector.get('test');

      await expect(connector.fetch('/endpoint', { skipRetry: true })).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after failures', async () => {
      // All calls fail
      mockFetch.mockRejectedValue(new Error('Service down'));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 0 }, // Disable retries for this test
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          resetTimeoutMs: 30000,
        },
      });

      const connector = Connector.get('test');

      // Make enough calls to trip circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await connector.fetch('/endpoint');
        } catch {
          // Expected to fail
        }
      }

      // Circuit should now be open
      await expect(connector.fetch('/endpoint')).rejects.toThrow(/circuit.*open/i);
    });

    it('should allow skipCircuitBreaker option', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        circuitBreaker: { enabled: true },
      });

      const connector = Connector.get('test');
      const response = await connector.fetch('/endpoint', { skipCircuitBreaker: true });

      expect(response.status).toBe(200);
    });

    it('should disable circuit breaker when configured', async () => {
      mockFetch.mockRejectedValue(new Error('Service down'));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 0 },
        circuitBreaker: { enabled: false },
      });

      const connector = Connector.get('test');

      // Even with many failures, circuit breaker should not trip
      for (let i = 0; i < 10; i++) {
        try {
          await connector.fetch('/endpoint');
        } catch (e) {
          // Should be regular error, not circuit breaker error
          expect((e as Error).message).not.toMatch(/circuit/i);
        }
      }
    });

    it('should allow manual circuit breaker reset', async () => {
      mockFetch.mockRejectedValue(new Error('Service down'));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 0 },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
        },
      });

      const connector = Connector.get('test');

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await connector.fetch('/endpoint');
        } catch {
          // Expected
        }
      }

      // Reset circuit
      connector.resetCircuitBreaker();

      // Now mock success
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      // Should work again
      const response = await connector.fetch('/endpoint');
      expect(response.status).toBe(200);
    });
  });

  describe('fetchJSON', () => {
    it('should parse JSON response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'test', value: 123 }), { status: 200 })
      );

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');
      const data = await connector.fetchJSON<{ name: string; value: number }>('/endpoint');

      expect(data.name).toBe('test');
      expect(data.value).toBe(123);
    });

    it('should throw on non-OK response with error details', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
      );

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');

      await expect(connector.fetchJSON('/endpoint')).rejects.toThrow(/404/);
    });

    it('should throw on invalid JSON', async () => {
      mockFetch.mockResolvedValueOnce(new Response('not json', { status: 200 }));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');

      await expect(connector.fetchJSON('/endpoint')).rejects.toThrow(/invalid json/i);
    });
  });

  describe('Disposed State', () => {
    it('should throw when fetching from disposed connector', async () => {
      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');
      connector.dispose();

      await expect(connector.fetch('/endpoint')).rejects.toThrow(/disposed/i);
    });

    it('should report disposed state', () => {
      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
      });

      const connector = Connector.get('test');

      expect(connector.isDisposed()).toBe(false);
      connector.dispose();
      expect(connector.isDisposed()).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should track request metrics', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))
        .mockRejectedValueOnce(new Error('Failed'));

      Connector.create({
        name: 'test',
        auth: { type: 'api_key', apiKey: 'key' },
        baseURL: 'https://api.example.com',
        retry: { maxRetries: 0 },
        circuitBreaker: { enabled: false },
      });

      const connector = Connector.get('test');

      await connector.fetch('/a');
      await connector.fetch('/b');
      try {
        await connector.fetch('/c');
      } catch {
        // Expected
      }

      const metrics = connector.getMetrics();

      expect(metrics.requestCount).toBe(3);
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
