/**
 * ProviderErrorMapper Unit Tests
 * Tests unified error mapping for all providers
 */

import { describe, it, expect } from 'vitest';
import { ProviderErrorMapper } from '@/infrastructure/providers/base/ProviderErrorMapper.js';
import {
  AIError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
  ProviderError,
} from '@/domain/errors/AIErrors.js';

describe('ProviderErrorMapper', () => {
  const context = {
    providerName: 'test-provider',
    maxContextTokens: 128000,
  };

  describe('mapError - AIError pass-through', () => {
    it('should return AIError instances as-is', () => {
      const authError = new ProviderAuthError('openai', 'Invalid API key');
      const result = ProviderErrorMapper.mapError(authError, context);
      expect(result).toBe(authError);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should return ProviderRateLimitError as-is', () => {
      const rateLimitError = new ProviderRateLimitError('anthropic', 60000);
      const result = ProviderErrorMapper.mapError(rateLimitError, context);
      expect(result).toBe(rateLimitError);
      expect(result).toBeInstanceOf(ProviderRateLimitError);
    });

    it('should return ProviderContextLengthError as-is', () => {
      const contextError = new ProviderContextLengthError('google', 100000);
      const result = ProviderErrorMapper.mapError(contextError, context);
      expect(result).toBe(contextError);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });
  });

  describe('mapError - Authentication errors', () => {
    it('should map 401 status to ProviderAuthError', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
      expect(result.message).toContain('Unauthorized');
    });

    it('should map 403 status to ProviderAuthError', () => {
      const error = { status: 403, message: 'Forbidden' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should detect "api key" in message', () => {
      const error = { message: 'Invalid API key provided' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should detect "api_key" in message', () => {
      const error = { message: 'Missing api_key parameter' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should detect "authentication" in message', () => {
      const error = { message: 'Authentication failed' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should detect "unauthorized" in message', () => {
      const error = { message: 'Request is unauthorized' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should detect "invalid key" in message', () => {
      const error = { message: 'You provided an invalid key' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should detect "permission denied" in message', () => {
      const error = { message: 'Permission denied for this resource' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should be case-insensitive', () => {
      const error = { message: 'INVALID API KEY' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderAuthError);
    });
  });

  describe('mapError - Rate limit errors', () => {
    it('should map 429 status to ProviderRateLimitError', () => {
      const error = { status: 429, message: 'Rate limit exceeded' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderRateLimitError);
    });

    it('should detect "rate limit" in message', () => {
      const error = { message: 'You have exceeded the rate limit' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderRateLimitError);
    });

    it('should detect "rate_limit" in message', () => {
      const error = { message: 'rate_limit_exceeded' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderRateLimitError);
    });

    it('should detect "too many requests" in message', () => {
      const error = { message: 'Too many requests, please slow down' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderRateLimitError);
    });

    it('should detect "resource exhausted" in message', () => {
      const error = { message: 'Resource exhausted' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderRateLimitError);
    });

    it('should detect "quota exceeded" in message', () => {
      const error = { message: 'Quota exceeded for requests' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderRateLimitError);
    });

    it('should extract retry-after from headers (lowercase)', () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        headers: { 'retry-after': '60' },
      };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result).toBeInstanceOf(ProviderRateLimitError);
      expect(result.retryAfter).toBe(60000); // 60 seconds in milliseconds
    });

    it('should extract retry-after from headers (capitalized)', () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        headers: { 'Retry-After': '30' },
      };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result.retryAfter).toBe(30000);
    });

    it('should extract retry-after from headers.get method', () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        headers: {
          get: (key: string) => (key === 'retry-after' ? '45' : null),
        },
      };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result.retryAfter).toBe(45000);
    });

    it('should extract retryAfter from error body (number)', () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        retryAfter: 120000, // Already in milliseconds
      };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result.retryAfter).toBe(120000);
    });

    it('should extract retryAfter from error body (string)', () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        retryAfter: '90', // Seconds as string
      };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result.retryAfter).toBe(90000);
    });

    it('should extract retry delay from Google-style error details', () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        errorDetails: [{ retryDelay: '60s' }],
      };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result.retryAfter).toBe(60000);
    });

    it('should extract retry delay from Google error details with multiple entries', () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        errorDetails: [{ foo: 'bar' }, { retryDelay: '120s' }],
      };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result.retryAfter).toBe(120000);
    });

    it('should handle rate limit error without retry-after', () => {
      const error = { status: 429, message: 'Rate limited' };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result).toBeInstanceOf(ProviderRateLimitError);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should handle invalid retry-after values gracefully', () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        headers: { 'retry-after': 'invalid' },
      };
      const result = ProviderErrorMapper.mapError(error, context) as ProviderRateLimitError;
      expect(result.retryAfter).toBeUndefined();
    });
  });

  describe('mapError - Context length errors', () => {
    it('should map 413 status to ProviderContextLengthError', () => {
      const error = { status: 413, message: 'Payload too large' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should detect context_length_exceeded code', () => {
      const error = { code: 'context_length_exceeded', message: 'Context too long' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should detect "context length" in message', () => {
      const error = { message: 'Context length exceeded' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should detect "context_length" in message', () => {
      const error = { message: 'context_length_exceeded error' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should detect "token limit" in message', () => {
      const error = { message: 'Token limit exceeded' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should detect "too long" in message', () => {
      const error = { message: 'Your prompt is too long' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should detect "maximum context" in message', () => {
      const error = { message: 'Maximum context window reached' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should detect "max_tokens" in message', () => {
      const error = { message: 'max_tokens exceeded' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should detect "prompt is too long" in message', () => {
      const error = { message: 'The prompt is too long for this model' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderContextLengthError);
    });

    it('should use maxContextTokens from context', () => {
      const error = { status: 413, message: 'Too large' };
      const result = ProviderErrorMapper.mapError(error, {
        providerName: 'test',
        maxContextTokens: 200000,
      }) as ProviderContextLengthError;
      expect(result.maxTokens).toBe(200000);
    });

    it('should use default maxContextTokens when not provided', () => {
      const error = { status: 413, message: 'Too large' };
      const result = ProviderErrorMapper.mapError(error, {
        providerName: 'test',
      }) as ProviderContextLengthError;
      expect(result.maxTokens).toBe(128000);
    });
  });

  describe('mapError - Generic errors', () => {
    it('should map unknown errors to ProviderError', () => {
      const error = { status: 500, message: 'Internal server error' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderError);
      expect(result.message).toContain('Internal server error');
    });

    it('should handle errors with statusCode instead of status', () => {
      const error = { statusCode: 500, message: 'Server error' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderError);
    });

    it('should handle errors with code instead of status', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderError);
    });

    it('should handle errors without message', () => {
      const error = { status: 500 };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderError);
    });

    it('should convert non-error objects to string', () => {
      const error = 'Something went wrong';
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderError);
      expect(result.message).toContain('Something went wrong');
    });

    it('should include original error in ProviderError', () => {
      const originalError = { status: 500, message: 'Test error', details: 'Extra info' };
      const result = ProviderErrorMapper.mapError(originalError, context) as ProviderError;
      expect(result.originalError).toBe(originalError);
    });
  });

  describe('Error priority', () => {
    it('should prioritize auth detection over rate limit', () => {
      const error = {
        status: 429,
        message: 'Rate limited due to invalid API key',
      };
      const result = ProviderErrorMapper.mapError(error, context);
      // Auth keywords detected first
      expect(result).toBeInstanceOf(ProviderAuthError);
    });

    it('should prioritize rate limit over context length', () => {
      const error = {
        status: 429,
        message: 'Rate limit exceeded, context too long',
      };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderRateLimitError);
    });

    it('should prioritize status codes appropriately', () => {
      const authError = { status: 401, message: 'Generic error' };
      const rateLimitError = { status: 429, message: 'Generic error' };
      const contextError = { status: 413, message: 'Generic error' };

      expect(ProviderErrorMapper.mapError(authError, context)).toBeInstanceOf(ProviderAuthError);
      expect(ProviderErrorMapper.mapError(rateLimitError, context)).toBeInstanceOf(
        ProviderRateLimitError
      );
      expect(ProviderErrorMapper.mapError(contextError, context)).toBeInstanceOf(
        ProviderContextLengthError
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty object error', () => {
      const result = ProviderErrorMapper.mapError({}, context);
      expect(result).toBeInstanceOf(ProviderError);
    });

    it('should handle error with complex nested structure', () => {
      const error = {
        status: 500,
        message: 'Error',
        data: { nested: { deep: { value: 'test' } } },
      };
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderError);
    });

    it('should handle error as plain string', () => {
      const error = 'Plain string error';
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderError);
      expect(result.message).toContain('Plain string error');
    });

    it('should handle error as number', () => {
      const error = 404;
      const result = ProviderErrorMapper.mapError(error, context);
      expect(result).toBeInstanceOf(ProviderError);
    });
  });
});
