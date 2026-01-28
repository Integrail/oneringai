/**
 * ErrorHandler Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ErrorHandler, ErrorContext, globalErrorHandler } from '@/core/ErrorHandler.js';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      logErrors: false, // Disable logging for tests
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    errorHandler.removeAllListeners();
  });

  describe('Constructor', () => {
    it('should create with default config', () => {
      const handler = new ErrorHandler();
      const config = handler.getConfig();

      expect(config.logErrors).toBe(true);
      expect(config.maxRetries).toBe(3);
      expect(config.baseRetryDelayMs).toBe(100);
      expect(config.maxRetryDelayMs).toBe(5000);
      expect(config.retryablePatterns).toContain('ECONNRESET');
      expect(config.retryablePatterns).toContain('rate limit');
    });

    it('should accept custom config', () => {
      const handler = new ErrorHandler({
        maxRetries: 5,
        baseRetryDelayMs: 200,
        retryablePatterns: ['CUSTOM_ERROR'],
      });
      const config = handler.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.baseRetryDelayMs).toBe(200);
      expect(config.retryablePatterns).toContain('CUSTOM_ERROR');
    });
  });

  describe('handle()', () => {
    it('should emit error event', () => {
      const listener = vi.fn();
      errorHandler.on('error', listener);

      const error = new Error('Test error');
      const context: ErrorContext = {
        agentType: 'agent',
        operation: 'run',
      };

      errorHandler.handle(error, context);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        error,
        context,
        recoverable: false,
      });
    });

    it('should emit error:fatal for non-recoverable errors', () => {
      const fatalListener = vi.fn();
      errorHandler.on('error:fatal', fatalListener);

      const error = new Error('Fatal error');
      const context: ErrorContext = {
        agentType: 'agent',
        operation: 'run',
      };

      errorHandler.handle(error, context);

      expect(fatalListener).toHaveBeenCalledTimes(1);
    });

    it('should not emit error:fatal for recoverable errors', () => {
      const fatalListener = vi.fn();
      errorHandler.on('error:fatal', fatalListener);

      const error = new Error('ECONNRESET: Connection reset');
      const context: ErrorContext = {
        agentType: 'agent',
        operation: 'run',
      };

      errorHandler.handle(error, context);

      expect(fatalListener).not.toHaveBeenCalled();
    });

    it('should transform error using custom transformer', () => {
      const customHandler = new ErrorHandler({
        logErrors: false,
        transformError: (error, context) => {
          return new Error(`Transformed: ${error.message} in ${context.operation}`);
        },
      });

      const listener = vi.fn();
      customHandler.on('error', listener);

      const error = new Error('Original');
      customHandler.handle(error, { agentType: 'agent', operation: 'test' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Transformed: Original in test',
          }),
        })
      );
    });
  });

  describe('isRecoverable()', () => {
    it('should return true for retryable errors', () => {
      expect(errorHandler.isRecoverable(new Error('ECONNRESET'))).toBe(true);
      expect(errorHandler.isRecoverable(new Error('rate limit exceeded'))).toBe(true);
      expect(errorHandler.isRecoverable(new Error('HTTP 429'))).toBe(true);
      expect(errorHandler.isRecoverable(new Error('Request timeout'))).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(errorHandler.isRecoverable(new Error('Invalid input'))).toBe(false);
      expect(errorHandler.isRecoverable(new Error('Not found'))).toBe(false);
    });

    it('should return true for recoverable error types', () => {
      class RateLimitError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'RateLimitError';
        }
      }

      expect(errorHandler.isRecoverable(new RateLimitError('Too many requests'))).toBe(true);
    });
  });

  describe('isRetryable()', () => {
    it('should return true for matching patterns', () => {
      expect(errorHandler.isRetryable(new Error('Connection ECONNRESET'))).toBe(true);
      expect(errorHandler.isRetryable(new Error('API rate limit hit'))).toBe(true);
      expect(errorHandler.isRetryable(new Error('Status 503'))).toBe(true);
    });

    it('should return false for non-matching patterns', () => {
      expect(errorHandler.isRetryable(new Error('Validation failed'))).toBe(false);
      expect(errorHandler.isRetryable(new Error('Unauthorized'))).toBe(false);
    });
  });

  describe('executeWithRetry()', () => {
    it('should return result on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await errorHandler.executeWithRetry(fn, {
        agentType: 'agent',
        operation: 'test',
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const result = await errorHandler.executeWithRetry(fn, {
        agentType: 'agent',
        operation: 'test',
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should emit error:retrying events', async () => {
      const retryListener = vi.fn();
      errorHandler.on('error:retrying', retryListener);

      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      await errorHandler.executeWithRetry(fn, {
        agentType: 'agent',
        operation: 'test',
      });

      expect(retryListener).toHaveBeenCalledTimes(1);
      expect(retryListener).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          delayMs: expect.any(Number),
        })
      );
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        errorHandler.executeWithRetry(fn, {
          agentType: 'agent',
          operation: 'test',
        })
      ).rejects.toThrow('ECONNRESET');

      expect(fn).toHaveBeenCalledTimes(3); // maxRetries = 3
    });

    it('should not retry non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(
        errorHandler.executeWithRetry(fn, {
          agentType: 'agent',
          operation: 'test',
        })
      ).rejects.toThrow('Invalid input');

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use exponential backoff', async () => {
      const handler = new ErrorHandler({
        logErrors: false,
        baseRetryDelayMs: 10, // Fast for testing
        maxRetryDelayMs: 1000,
      });

      const delays: number[] = [];
      handler.on('error:retrying', ({ delayMs }) => {
        delays.push(delayMs);
      });

      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      await handler.executeWithRetry(fn, {
        agentType: 'agent',
        operation: 'test',
      });

      // Second delay should be roughly 2x first (with jitter ±20%)
      // Worst case: first=12 (10*1.2), second=16 (20*0.8), ratio=1.33
      // So we use 1.2 as a conservative multiplier
      expect(delays[1]).toBeGreaterThan(delays[0] * 1.2);
    });
  });

  describe('wrap()', () => {
    it('should wrap function and handle errors', async () => {
      const listener = vi.fn();
      errorHandler.on('error', listener);

      const riskyFn = async (x: number) => {
        if (x < 0) throw new Error('Negative');
        return x * 2;
      };

      const wrappedFn = errorHandler.wrap(riskyFn, (x) => ({
        agentType: 'agent',
        operation: 'multiply',
        metadata: { input: x },
      }));

      // Success case
      expect(await wrappedFn(5)).toBe(10);
      expect(listener).not.toHaveBeenCalled();

      // Error case
      await expect(wrappedFn(-1)).rejects.toThrow('Negative');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('addRetryablePattern() / removeRetryablePattern()', () => {
    it('should add custom retryable pattern', () => {
      errorHandler.addRetryablePattern('CUSTOM_ERROR');

      expect(errorHandler.isRetryable(new Error('CUSTOM_ERROR occurred'))).toBe(true);
    });

    it('should not add duplicate patterns', () => {
      const initialLength = errorHandler.getConfig().retryablePatterns.length;

      errorHandler.addRetryablePattern('ECONNRESET'); // Already exists

      expect(errorHandler.getConfig().retryablePatterns.length).toBe(initialLength);
    });

    it('should remove retryable pattern', () => {
      errorHandler.removeRetryablePattern('ECONNRESET');

      expect(errorHandler.isRetryable(new Error('ECONNRESET'))).toBe(false);
    });
  });

  describe('globalErrorHandler', () => {
    it('should be an instance of ErrorHandler', () => {
      expect(globalErrorHandler).toBeInstanceOf(ErrorHandler);
    });

    it('should be usable as singleton', () => {
      const listener = vi.fn();
      globalErrorHandler.on('error', listener);

      try {
        globalErrorHandler.handle(new Error('Test'), {
          agentType: 'agent',
          operation: 'test',
        });

        expect(listener).toHaveBeenCalled();
      } finally {
        globalErrorHandler.off('error', listener);
      }
    });
  });
});
