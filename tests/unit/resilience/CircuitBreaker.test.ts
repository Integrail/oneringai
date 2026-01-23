/**
 * Circuit Breaker Tests
 *
 * Comprehensive tests for the generic CircuitBreaker implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitOpenError, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../../../src/infrastructure/resilience/CircuitBreaker.js';

describe('CircuitBreaker', () => {
  describe('Construction and Configuration', () => {
    it('should create with default configuration', () => {
      const breaker = new CircuitBreaker('test');

      expect(breaker.name).toBe('test');
      expect(breaker.getState()).toBe('closed');

      const config = breaker.getConfig();
      expect(config.failureThreshold).toBe(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold);
      expect(config.successThreshold).toBe(DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold);
    });

    it('should create with custom configuration', () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 10,
        successThreshold: 3,
        resetTimeoutMs: 60000,
        windowMs: 120000,
      });

      const config = breaker.getConfig();
      expect(config.failureThreshold).toBe(10);
      expect(config.successThreshold).toBe(3);
      expect(config.resetTimeoutMs).toBe(60000);
    });
  });

  describe('CLOSED State (Normal Operation)', () => {
    it('should execute function successfully in closed state', async () => {
      const breaker = new CircuitBreaker('test');

      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe('closed');
    });

    it('should track successful executions', async () => {
      const breaker = new CircuitBreaker('test');

      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));

      const metrics = breaker.getMetrics();
      expect(metrics.successCount).toBe(3);
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.state).toBe('closed');
    });

    it('should stay closed on single failure', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 5,
        successThreshold: 2,
        resetTimeoutMs: 1000,
        windowMs: 5000,
      });

      await expect(
        breaker.execute(() => Promise.reject(new Error('failed')))
      ).rejects.toThrow('failed');

      expect(breaker.getState()).toBe('closed');

      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
      expect(metrics.recentFailures).toBe(1);
    });

    it('should open after failure threshold exceeded', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        successThreshold: 2,
        resetTimeoutMs: 1000,
        windowMs: 5000,
      });

      let openedEventEmitted = false;
      breaker.on('opened', () => {
        openedEventEmitted = true;
      });

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      expect(breaker.getState()).toBe('open');
      expect(openedEventEmitted).toBe(true);
    });
  });

  describe('OPEN State (Fast Fail)', () => {
    it('should reject immediately when circuit is open', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 10000,
        windowMs: 5000,
      });

      // Fail twice to open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      expect(breaker.getState()).toBe('open');

      // Next call should fail immediately with CircuitOpenError
      const fn = vi.fn();
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError);

      // Function should NOT have been called
      expect(fn).not.toHaveBeenCalled();
    });

    it('should track rejected requests', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 1000,
        windowMs: 5000,
      });

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Try 5 more times (all should be rejected)
      for (let i = 0; i < 5; i++) {
        await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
      }

      const metrics = breaker.getMetrics();
      expect(metrics.rejectedCount).toBe(5);
    });

    it('should transition to half-open after timeout', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 100, // Very short timeout
        windowMs: 5000,
      });

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      expect(breaker.getState()).toBe('open');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next execute should transition to half-open
      let halfOpenEmitted = false;
      breaker.on('half-open', () => {
        halfOpenEmitted = true;
      });

      await breaker.execute(() => Promise.resolve('ok'));

      expect(halfOpenEmitted).toBe(true);
    });
  });

  describe('HALF-OPEN State (Trial Mode)', () => {
    async function openCircuit(breaker: CircuitBreaker) {
      const config = breaker.getConfig();
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      }
    }

    it('should allow one request in half-open state', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100,
        windowMs: 5000,
      });

      // Open circuit
      await openCircuit(breaker);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Try request (should trigger half-open)
      const fn = vi.fn().mockResolvedValue('success');
      await breaker.execute(fn);

      expect(fn).toHaveBeenCalled();
    });

    it('should close circuit after success threshold in half-open', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100,
        windowMs: 5000,
      });

      let closedEventEmitted = false;
      breaker.on('closed', () => {
        closedEventEmitted = true;
      });

      // Open circuit
      await openCircuit(breaker);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Success #1 (should transition to half-open)
      await breaker.execute(() => Promise.resolve('ok'));

      // Success #2 (should close circuit)
      await breaker.execute(() => Promise.resolve('ok'));

      expect(breaker.getState()).toBe('closed');
      expect(closedEventEmitted).toBe(true);
    });

    it('should return to open on failure in half-open', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100,
        windowMs: 5000,
      });

      // Open circuit
      await openCircuit(breaker);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Failure in half-open should return to open
      await expect(breaker.execute(() => Promise.reject(new Error('still failing')))).rejects.toThrow();

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('Failure Counting and Window', () => {
    it('should count failures within time window', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        successThreshold: 1,
        resetTimeoutMs: 1000,
        windowMs: 200, // Short window
      });

      // Fail twice
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Old failures should be pruned, circuit should still be closed
      const metrics = breaker.getMetrics();
      expect(metrics.recentFailures).toBe(0);
      expect(breaker.getState()).toBe('closed');
    });

    it('should only count failures in rolling window', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        successThreshold: 1,
        resetTimeoutMs: 1000,
        windowMs: 500,
      });

      // Fail once
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait 600ms (outside window)
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Fail twice more (but first failure has expired)
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Should still be closed (only 2 failures in window, threshold is 3)
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Error Classification', () => {
    it('should respect isRetryable classification', async () => {
      class NonRetryableError extends Error {
        constructor() {
          super('Non-retryable error');
          this.name = 'NonRetryableError';
        }
      }

      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 1000,
        windowMs: 5000,
        isRetryable: (error) => {
          // Don't count NonRetryableError toward circuit breaker
          return !(error instanceof NonRetryableError);
        },
      });

      // Throw non-retryable errors 10 times
      for (let i = 0; i < 10; i++) {
        await expect(breaker.execute(() => Promise.reject(new NonRetryableError()))).rejects.toThrow(
          NonRetryableError
        );
      }

      // Circuit should still be closed (non-retryable errors don't count)
      expect(breaker.getState()).toBe('closed');

      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(0); // Not counted
    });

    it('should count retryable errors toward threshold', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 1000,
        windowMs: 5000,
        isRetryable: (error) => error.message.includes('retryable'),
      });

      // Non-retryable error
      await expect(breaker.execute(() => Promise.reject(new Error('permanent')))).rejects.toThrow();

      // Retryable errors
      await expect(breaker.execute(() => Promise.reject(new Error('retryable1')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('retryable2')))).rejects.toThrow();

      // Circuit should be open (2 retryable failures)
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('Manual Operations', () => {
    it('should allow manual reset', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 10000,
        windowMs: 5000,
      });

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      expect(breaker.getState()).toBe('open');

      // Manual reset
      breaker.reset();

      expect(breaker.getState()).toBe('closed');

      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });

    it('should check if circuit is open', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 10000,
        windowMs: 5000,
      });

      expect(breaker.isOpen()).toBe(false);

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      expect(breaker.isOpen()).toBe(true);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track comprehensive metrics', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        successThreshold: 1,
        resetTimeoutMs: 1000,
        windowMs: 5000,
      });

      // Mix of successes and failures
      await breaker.execute(() => Promise.resolve('ok'));
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await breaker.execute(() => Promise.resolve('ok'));

      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.successRate).toBeCloseTo(2 / 3);
      expect(metrics.failureRate).toBeCloseTo(1 / 3);
    });

    it('should provide timing information', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 100,
        windowMs: 5000,
      });

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      const metrics = breaker.getMetrics();
      expect(metrics.lastFailureTime).toBeDefined();
      expect(metrics.lastStateChange).toBeDefined();
      expect(metrics.nextRetryTime).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit "opened" event when circuit opens', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 1000,
        windowMs: 5000,
      });

      const openHandler = vi.fn();
      breaker.on('opened', openHandler);

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      expect(openHandler).toHaveBeenCalledTimes(1);
      expect(openHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test',
          failureCount: 2,
          lastError: 'fail',
        })
      );
    });

    it('should emit "half-open" event when transitioning from open', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 100,
        windowMs: 5000,
      });

      const halfOpenHandler = vi.fn();
      breaker.on('half-open', halfOpenHandler);

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next execute should trigger half-open
      await breaker.execute(() => Promise.resolve('ok'));

      expect(halfOpenHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit "closed" event when circuit recovers', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100,
        windowMs: 5000,
      });

      const closedHandler = vi.fn();
      breaker.on('closed', closedHandler);

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Succeed twice to close
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));

      expect(closedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle synchronous errors', async () => {
      const breaker = new CircuitBreaker('test');

      await expect(
        breaker.execute(() => {
          throw new Error('sync error');
        })
      ).rejects.toThrow('sync error');
    });

    it('should handle async rejections', async () => {
      const breaker = new CircuitBreaker('test');

      await expect(
        breaker.execute(async () => {
          throw new Error('async error');
        })
      ).rejects.toThrow('async error');
    });

    it('should handle undefined/null returns', async () => {
      const breaker = new CircuitBreaker('test');

      const result1 = await breaker.execute(() => Promise.resolve(undefined));
      const result2 = await breaker.execute(() => Promise.resolve(null));

      expect(result1).toBeUndefined();
      expect(result2).toBeNull();
    });

    it('should handle rapid successive calls', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 5,
        successThreshold: 1,
        resetTimeoutMs: 1000,
        windowMs: 5000,
      });

      // 100 rapid successful calls
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(breaker.execute(() => Promise.resolve(i)));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(breaker.getState()).toBe('closed');

      const metrics = breaker.getMetrics();
      expect(metrics.successCount).toBe(100);
    });

    it('should handle concurrent executions', async () => {
      const breaker = new CircuitBreaker('test');

      const promises = [
        breaker.execute(() => Promise.resolve(1)),
        breaker.execute(() => Promise.resolve(2)),
        breaker.execute(() => Promise.resolve(3)),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('CircuitOpenError', () => {
    it('should provide detailed error information', async () => {
      const breaker = new CircuitBreaker('test-breaker', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 5000,
        windowMs: 10000,
      });

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('original error')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('original error')))).rejects.toThrow();

      // Try again (should get CircuitOpenError)
      try {
        await breaker.execute(() => Promise.resolve('ok'));
        throw new Error('Should have thrown CircuitOpenError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        const cbError = error as CircuitOpenError;
        expect(cbError.breakerName).toBe('test-breaker');
        expect(cbError.failureCount).toBe(2);
        expect(cbError.lastError).toBe('original error');
        expect(cbError.nextRetryTime).toBeGreaterThan(Date.now());
      }
    });
  });

  describe('State Transitions', () => {
    it('should follow complete lifecycle: CLOSED → OPEN → HALF-OPEN → CLOSED', async () => {
      const breaker = new CircuitBreaker('lifecycle-test', {
        failureThreshold: 2,
        successThreshold: 1,
        resetTimeoutMs: 100,
        windowMs: 5000,
      });

      const states: string[] = [];

      breaker.on('opened', () => states.push('opened'));
      breaker.on('half-open', () => states.push('half-open'));
      breaker.on('closed', () => states.push('closed'));

      // Start: CLOSED
      expect(breaker.getState()).toBe('closed');

      // Fail twice → OPEN
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      expect(breaker.getState()).toBe('open');

      // Wait for timeout → HALF-OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Success → CLOSED
      await breaker.execute(() => Promise.resolve('ok'));

      expect(breaker.getState()).toBe('closed');

      // Verify event sequence
      expect(states).toEqual(['opened', 'half-open', 'closed']);
    });
  });

  describe('Success Reset', () => {
    it('should reset consecutive successes on failure', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        successThreshold: 5, // Need 5 successes to close
        resetTimeoutMs: 100,
        windowMs: 5000,
      });

      // Open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Wait for half-open
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 4 successes (not enough to close - need 5)
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));

      expect(breaker.getState()).toBe('half-open');

      // One failure should reset counter and return to open
      await expect(breaker.execute(() => Promise.reject(new Error('fail again')))).rejects.toThrow();

      expect(breaker.getState()).toBe('open');

      const metrics = breaker.getMetrics();
      expect(metrics.consecutiveSuccesses).toBe(0);
    });
  });
});
