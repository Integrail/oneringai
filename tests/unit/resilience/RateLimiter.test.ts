/**
 * TokenBucketRateLimiter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TokenBucketRateLimiter,
  RateLimitError,
  DEFAULT_RATE_LIMITER_CONFIG,
} from '@/infrastructure/resilience/RateLimiter.js';

describe('TokenBucketRateLimiter', () => {
  let rateLimiter: TokenBucketRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimiter = new TokenBucketRateLimiter({
      maxRequests: 5,
      windowMs: 1000,
      onLimit: 'throw',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default configuration when not specified', () => {
      const defaultLimiter = new TokenBucketRateLimiter();
      const config = defaultLimiter.getConfig();

      expect(config.maxRequests).toBe(DEFAULT_RATE_LIMITER_CONFIG.maxRequests);
      expect(config.windowMs).toBe(DEFAULT_RATE_LIMITER_CONFIG.windowMs);
      expect(config.onLimit).toBe(DEFAULT_RATE_LIMITER_CONFIG.onLimit);
      expect(config.maxWaitMs).toBe(DEFAULT_RATE_LIMITER_CONFIG.maxWaitMs);
    });

    it('should merge partial configuration with defaults', () => {
      const limiter = new TokenBucketRateLimiter({ maxRequests: 10 });
      const config = limiter.getConfig();

      expect(config.maxRequests).toBe(10);
      expect(config.windowMs).toBe(DEFAULT_RATE_LIMITER_CONFIG.windowMs);
    });

    it('should initialize with full tokens', () => {
      expect(rateLimiter.getAvailableTokens()).toBe(5);
    });
  });

  describe('acquire()', () => {
    it('should succeed when tokens are available', async () => {
      await expect(rateLimiter.acquire()).resolves.toBeUndefined();
      expect(rateLimiter.getAvailableTokens()).toBe(4);
    });

    it('should consume tokens with each call', async () => {
      await rateLimiter.acquire();
      await rateLimiter.acquire();
      await rateLimiter.acquire();

      expect(rateLimiter.getAvailableTokens()).toBe(2);
    });

    it('should throw RateLimitError when no tokens and onLimit is throw', async () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.acquire();
      }

      await expect(rateLimiter.acquire()).rejects.toThrow(RateLimitError);
    });

    it('should wait for refill when onLimit is wait', async () => {
      const waitLimiter = new TokenBucketRateLimiter({
        maxRequests: 2,
        windowMs: 1000,
        onLimit: 'wait',
        maxWaitMs: 5000,
      });

      // Exhaust tokens
      await waitLimiter.acquire();
      await waitLimiter.acquire();

      // Start acquiring - should wait
      const acquirePromise = waitLimiter.acquire();

      // Advance time past window
      await vi.advanceTimersByTimeAsync(1000);

      // Should resolve after refill
      await expect(acquirePromise).resolves.toBeUndefined();
    });

    it('should throw when wait time exceeds maxWaitMs', async () => {
      const shortWaitLimiter = new TokenBucketRateLimiter({
        maxRequests: 1,
        windowMs: 10000, // 10 second window
        onLimit: 'wait',
        maxWaitMs: 1000, // Only wait 1 second max
      });

      // Exhaust tokens
      await shortWaitLimiter.acquire();

      // Should throw because wait time (10s) > maxWaitMs (1s)
      await expect(shortWaitLimiter.acquire()).rejects.toThrow(RateLimitError);
      await expect(shortWaitLimiter.acquire()).rejects.toThrow(
        /Wait time.*exceeds max/
      );
    });

    it('should track metrics correctly', async () => {
      await rateLimiter.acquire();
      await rateLimiter.acquire();

      // Try to acquire when no tokens (should throw)
      await rateLimiter.acquire();
      await rateLimiter.acquire();
      await rateLimiter.acquire();

      // This should fail
      try {
        await rateLimiter.acquire();
      } catch {
        // Expected
      }

      const metrics = rateLimiter.getMetrics();
      expect(metrics.totalRequests).toBe(6);
      expect(metrics.throttledRequests).toBe(1);
    });
  });

  describe('tryAcquire()', () => {
    it('should return true when tokens available', () => {
      expect(rateLimiter.tryAcquire()).toBe(true);
      expect(rateLimiter.getAvailableTokens()).toBe(4);
    });

    it('should return false when no tokens available', () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      expect(rateLimiter.tryAcquire()).toBe(false);
    });

    it('should not throw when no tokens', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      expect(() => rateLimiter.tryAcquire()).not.toThrow();
    });
  });

  describe('getWaitTime()', () => {
    it('should return 0 when tokens available', () => {
      expect(rateLimiter.getWaitTime()).toBe(0);
    });

    it('should return remaining window time when no tokens', () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      // Advance time by 300ms
      vi.advanceTimersByTime(300);

      // Should wait remaining 700ms
      const waitTime = rateLimiter.getWaitTime();
      expect(waitTime).toBe(700);
    });

    it('should return 0 after window expires', () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      // Advance past window
      vi.advanceTimersByTime(1001);

      expect(rateLimiter.getWaitTime()).toBe(0);
    });
  });

  describe('reset()', () => {
    it('should restore all tokens', async () => {
      await rateLimiter.acquire();
      await rateLimiter.acquire();

      expect(rateLimiter.getAvailableTokens()).toBe(3);

      rateLimiter.reset();

      expect(rateLimiter.getAvailableTokens()).toBe(5);
    });

    it('should clear wait queue', async () => {
      const waitLimiter = new TokenBucketRateLimiter({
        maxRequests: 1,
        windowMs: 10000,
        onLimit: 'wait',
        maxWaitMs: 20000,
      });

      await waitLimiter.acquire();

      // Start waiting
      const acquirePromise = waitLimiter.acquire();

      // Reset while waiting
      waitLimiter.reset();

      // The promise should eventually complete after reset restores tokens
      // Advance time to trigger the timeout
      await vi.advanceTimersByTimeAsync(10000);

      // New acquire should work immediately
      expect(waitLimiter.getAvailableTokens()).toBe(1);
    });
  });

  describe('resetMetrics()', () => {
    it('should clear all metrics', async () => {
      await rateLimiter.acquire();
      await rateLimiter.acquire();

      let metrics = rateLimiter.getMetrics();
      expect(metrics.totalRequests).toBe(2);

      rateLimiter.resetMetrics();

      metrics = rateLimiter.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.throttledRequests).toBe(0);
      expect(metrics.totalWaitMs).toBe(0);
      expect(metrics.avgWaitMs).toBe(0);
    });
  });

  describe('refill behavior', () => {
    it('should refill tokens after window expires', () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }
      expect(rateLimiter.getAvailableTokens()).toBe(0);

      // Advance past window
      vi.advanceTimersByTime(1001);

      expect(rateLimiter.getAvailableTokens()).toBe(5);
    });

    it('should not refill before window expires', () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryAcquire();
      }

      // Advance but not past window
      vi.advanceTimersByTime(500);

      expect(rateLimiter.getAvailableTokens()).toBe(0);
    });

    it('should process wait queue on refill', async () => {
      const waitLimiter = new TokenBucketRateLimiter({
        maxRequests: 2,
        windowMs: 1000,
        onLimit: 'wait',
        maxWaitMs: 5000,
      });

      // Exhaust tokens
      await waitLimiter.acquire();
      await waitLimiter.acquire();

      // Start multiple waiters
      const waiter1 = waitLimiter.acquire();
      const waiter2 = waitLimiter.acquire();

      // Advance past window
      await vi.advanceTimersByTimeAsync(1000);

      // Both should resolve
      await expect(waiter1).resolves.toBeUndefined();
      await expect(waiter2).resolves.toBeUndefined();
    });
  });

  describe('RateLimitError', () => {
    it('should include retry after time', async () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.acquire();
      }

      vi.advanceTimersByTime(300);

      try {
        await rateLimiter.acquire();
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect(error.retryAfterMs).toBe(700);
        expect(error.code).toBe('RATE_LIMIT_ERROR');
        expect(error.statusCode).toBe(429);
      }
    });

    it('should use custom message when provided', () => {
      const error = new RateLimitError(1000, 'Custom message');
      expect(error.message).toBe('Custom message');
    });

    it('should use default message when not provided', () => {
      const error = new RateLimitError(1000);
      expect(error.message).toBe('Rate limited. Retry after 1000ms');
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent acquires correctly', async () => {
      const limiter = new TokenBucketRateLimiter({
        maxRequests: 3,
        windowMs: 1000,
        onLimit: 'throw',
      });

      // Start 3 concurrent acquires - all should succeed
      const results = await Promise.allSettled([
        limiter.acquire(),
        limiter.acquire(),
        limiter.acquire(),
      ]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(0);
    });

    it('should reject excess concurrent requests in throw mode', async () => {
      const limiter = new TokenBucketRateLimiter({
        maxRequests: 2,
        windowMs: 1000,
        onLimit: 'throw',
      });

      // Start 4 concurrent acquires - 2 should fail
      const results = await Promise.allSettled([
        limiter.acquire(),
        limiter.acquire(),
        limiter.acquire(),
        limiter.acquire(),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(2);
    });
  });

  describe('metrics tracking', () => {
    it('should track total wait time in wait mode', async () => {
      const waitLimiter = new TokenBucketRateLimiter({
        maxRequests: 1,
        windowMs: 100,
        onLimit: 'wait',
        maxWaitMs: 1000,
      });

      await waitLimiter.acquire();

      // This will wait
      const acquirePromise = waitLimiter.acquire();

      // Advance time
      await vi.advanceTimersByTimeAsync(100);

      await acquirePromise;

      const metrics = waitLimiter.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.throttledRequests).toBe(1);
      expect(metrics.totalWaitMs).toBeGreaterThanOrEqual(100);
    });

    it('should calculate average wait time correctly', async () => {
      const waitLimiter = new TokenBucketRateLimiter({
        maxRequests: 1,
        windowMs: 100,
        onLimit: 'wait',
        maxWaitMs: 1000,
      });

      await waitLimiter.acquire();

      // Wait 1
      const wait1 = waitLimiter.acquire();
      await vi.advanceTimersByTimeAsync(100);
      await wait1;

      // Wait 2
      const wait2 = waitLimiter.acquire();
      await vi.advanceTimersByTimeAsync(100);
      await wait2;

      const metrics = waitLimiter.getMetrics();
      expect(metrics.throttledRequests).toBe(2);
      expect(metrics.avgWaitMs).toBeGreaterThanOrEqual(100);
    });
  });

  describe('getConfig()', () => {
    it('should return a copy of the config', () => {
      const config = rateLimiter.getConfig();

      expect(config.maxRequests).toBe(5);
      expect(config.windowMs).toBe(1000);
      expect(config.onLimit).toBe('throw');

      // Modifying returned config shouldn't affect limiter
      (config as any).maxRequests = 100;
      expect(rateLimiter.getConfig().maxRequests).toBe(5);
    });
  });
});
