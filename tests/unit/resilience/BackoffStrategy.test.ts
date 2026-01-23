/**
 * Backoff Strategy Tests
 *
 * Tests for exponential backoff, jitter, and retry logic.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateBackoff,
  addJitter,
  backoffWait,
  backoffSequence,
  retryWithBackoff,
  DEFAULT_BACKOFF_CONFIG,
} from '../../../src/infrastructure/resilience/BackoffStrategy.js';

describe('BackoffStrategy', () => {
  describe('calculateBackoff', () => {
    it('should calculate exponential backoff correctly', () => {
      const config = {
        strategy: 'exponential' as const,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
        jitter: false,
      };

      expect(calculateBackoff(1, config)).toBe(1000); // 1000 * 2^0
      expect(calculateBackoff(2, config)).toBe(2000); // 1000 * 2^1
      expect(calculateBackoff(3, config)).toBe(4000); // 1000 * 2^2
      expect(calculateBackoff(4, config)).toBe(8000); // 1000 * 2^3
      expect(calculateBackoff(5, config)).toBe(16000); // 1000 * 2^4
      expect(calculateBackoff(6, config)).toBe(30000); // Capped at max
      expect(calculateBackoff(7, config)).toBe(30000); // Still capped
    });

    it('should calculate linear backoff correctly', () => {
      const config = {
        strategy: 'linear' as const,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        incrementMs: 1000,
        jitter: false,
      };

      expect(calculateBackoff(1, config)).toBe(1000); // 1000 + 1000*0
      expect(calculateBackoff(2, config)).toBe(2000); // 1000 + 1000*1
      expect(calculateBackoff(3, config)).toBe(3000); // 1000 + 1000*2
      expect(calculateBackoff(10, config)).toBe(10000); // Capped at max
    });

    it('should calculate constant backoff correctly', () => {
      const config = {
        strategy: 'constant' as const,
        initialDelayMs: 5000,
        maxDelayMs: 30000,
        jitter: false,
      };

      expect(calculateBackoff(1, config)).toBe(5000);
      expect(calculateBackoff(2, config)).toBe(5000);
      expect(calculateBackoff(10, config)).toBe(5000);
    });

    it('should use default configuration when not provided', () => {
      const delay = calculateBackoff(1);

      // Default has jitter enabled, so delay will vary around initialDelayMs
      const expected = DEFAULT_BACKOFF_CONFIG.initialDelayMs;
      const jitterFactor = DEFAULT_BACKOFF_CONFIG.jitterFactor || 0.1;
      const minDelay = expected * (1 - jitterFactor);
      const maxDelay = expected * (1 + jitterFactor);

      expect(delay).toBeGreaterThanOrEqual(minDelay);
      expect(delay).toBeLessThanOrEqual(maxDelay);
    });

    it('should respect max delay cap', () => {
      const config = {
        strategy: 'exponential' as const,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        multiplier: 10,
        jitter: false,
      };

      // Would be 10000 without cap
      expect(calculateBackoff(2, config)).toBe(5000);
    });

    it('should handle custom multiplier', () => {
      const config = {
        strategy: 'exponential' as const,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        multiplier: 3,
        jitter: false,
      };

      expect(calculateBackoff(1, config)).toBe(100); // 100 * 3^0
      expect(calculateBackoff(2, config)).toBe(300); // 100 * 3^1
      expect(calculateBackoff(3, config)).toBe(900); // 100 * 3^2
    });
  });

  describe('addJitter', () => {
    it('should add jitter within expected range', () => {
      const delay = 1000;
      const factor = 0.1; // ±10%

      const results = [];
      for (let i = 0; i < 100; i++) {
        const jittered = addJitter(delay, factor);
        results.push(jittered);

        // Should be within ±10% of 1000 (900-1100)
        expect(jittered).toBeGreaterThanOrEqual(900);
        expect(jittered).toBeLessThanOrEqual(1100);
      }

      // Should have variance (not all the same)
      const unique = new Set(results.map((r) => Math.floor(r)));
      expect(unique.size).toBeGreaterThan(10);
    });

    it('should work with custom jitter factor', () => {
      const delay = 1000;
      const factor = 0.5; // ±50%

      const results = [];
      for (let i = 0; i < 100; i++) {
        const jittered = addJitter(delay, factor);
        results.push(jittered);

        // Should be within ±50% (500-1500)
        expect(jittered).toBeGreaterThanOrEqual(500);
        expect(jittered).toBeLessThanOrEqual(1500);
      }
    });

    it('should add jitter when enabled in config', () => {
      const config = {
        strategy: 'exponential' as const,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
        jitter: true,
        jitterFactor: 0.1,
      };

      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(calculateBackoff(1, config));
      }

      // With jitter, delays should vary
      const unique = new Set(delays.map((d) => Math.floor(d)));
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('backoffWait', () => {
    it('should wait for calculated duration', async () => {
      const config = {
        strategy: 'constant' as const,
        initialDelayMs: 50, // Short for testing
        maxDelayMs: 1000,
        jitter: false,
      };

      const start = Date.now();
      const actualDelay = await backoffWait(1, config);
      const elapsed = Date.now() - start;

      expect(actualDelay).toBe(50);
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some slack
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('backoffSequence', () => {
    it('should generate sequence of delays', () => {
      const config = {
        strategy: 'exponential' as const,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        multiplier: 2,
        jitter: false,
      };

      const sequence = backoffSequence(config, 5);
      const delays = [];

      for (const delay of sequence) {
        delays.push(delay);
      }

      expect(delays).toEqual([100, 200, 400, 800, 1000]); // Last capped
    });

    it('should respect maxAttempts', () => {
      const sequence = backoffSequence(DEFAULT_BACKOFF_CONFIG, 3);
      const delays = Array.from(sequence);

      expect(delays).toHaveLength(3);
    });

    it('should generate infinite sequence when no maxAttempts', () => {
      const sequence = backoffSequence(DEFAULT_BACKOFF_CONFIG);

      let count = 0;
      for (const _delay of sequence) {
        count++;
        if (count > 10) break; // Safety
      }

      expect(count).toBe(11);
    });
  });

  describe('retryWithBackoff', () => {
    it('should retry on failure and succeed', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('not yet');
        }
        return 'success';
      });

      const config = {
        strategy: 'constant' as const,
        initialDelayMs: 10,
        maxDelayMs: 100,
        jitter: false,
      };

      const result = await retryWithBackoff(fn, config, 5);

      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      const config = {
        strategy: 'constant' as const,
        initialDelayMs: 10,
        maxDelayMs: 100,
        jitter: false,
      };

      await expect(retryWithBackoff(fn, config, 3)).rejects.toThrow('always fails');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      class NonRetryableError extends Error {}

      const fn = vi.fn().mockRejectedValue(new NonRetryableError('stop'));

      const config = {
        strategy: 'constant' as const,
        initialDelayMs: 10,
        maxDelayMs: 100,
        jitter: false,
        isRetryable: (error: Error) => !(error instanceof NonRetryableError),
      };

      await expect(retryWithBackoff(fn, config, 5)).rejects.toThrow(NonRetryableError);

      // Should only try once (not retry)
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn, DEFAULT_BACKOFF_CONFIG, 3);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
