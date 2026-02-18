/**
 * Unified error mapper for all providers
 * Converts provider-specific errors to our standard error types
 */

import {
  AIError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderContextLengthError,
  ProviderError,
} from '../../../domain/errors/AIErrors.js';
import { resolveMaxContextTokens } from './ModelCapabilityResolver.js';

export interface ProviderErrorContext {
  providerName: string;
  maxContextTokens?: number;
  model?: string;
}

/**
 * Maps provider-specific errors to our unified error types
 */
export class ProviderErrorMapper {
  /**
   * Map any provider error to our standard error types
   */
  static mapError(error: any, context: ProviderErrorContext): AIError {
    const { providerName, maxContextTokens, model } = context;
    const effectiveMaxTokens = model
      ? resolveMaxContextTokens(model, maxContextTokens ?? 128000)
      : (maxContextTokens ?? 128000);

    // Already our error type - return as-is
    if (error instanceof AIError) {
      return error;
    }

    // Extract error details
    const status = error.status || error.statusCode || error.code;
    const message = error.message || String(error);
    const messageLower = message.toLowerCase();

    // Auth errors (401, 403, or message indicators)
    if (
      status === 401 ||
      status === 403 ||
      messageLower.includes('api key') ||
      messageLower.includes('api_key') ||
      messageLower.includes('authentication') ||
      messageLower.includes('unauthorized') ||
      messageLower.includes('invalid key') ||
      messageLower.includes('permission denied')
    ) {
      return new ProviderAuthError(providerName, message);
    }

    // Rate limit errors (429 or message indicators)
    if (
      status === 429 ||
      messageLower.includes('rate limit') ||
      messageLower.includes('rate_limit') ||
      messageLower.includes('too many requests') ||
      messageLower.includes('resource exhausted') ||
      messageLower.includes('quota exceeded')
    ) {
      const retryAfter = this.extractRetryAfter(error);
      return new ProviderRateLimitError(providerName, retryAfter);
    }

    // Context length errors (413 or message indicators)
    if (
      status === 413 ||
      error.code === 'context_length_exceeded' ||
      messageLower.includes('context length') ||
      messageLower.includes('context_length') ||
      messageLower.includes('token limit') ||
      messageLower.includes('too long') ||
      messageLower.includes('maximum context') ||
      messageLower.includes('max_tokens') ||
      messageLower.includes('prompt is too long')
    ) {
      return new ProviderContextLengthError(providerName, effectiveMaxTokens);
    }

    // Generic provider error for everything else
    return new ProviderError(providerName, message, status, error);
  }

  /**
   * Extract retry-after value from error headers or body
   */
  private static extractRetryAfter(error: any): number | undefined {
    // Check headers (common for HTTP responses)
    const retryAfterHeader =
      error.headers?.['retry-after'] ||
      error.headers?.['Retry-After'] ||
      error.headers?.get?.('retry-after');

    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000; // Convert to milliseconds
      }
    }

    // Check error body for retry info
    if (error.retryAfter) {
      return typeof error.retryAfter === 'number'
        ? error.retryAfter
        : parseInt(error.retryAfter, 10) * 1000;
    }

    // Check for Google-style error details
    if (error.errorDetails) {
      for (const detail of error.errorDetails) {
        if (detail.retryDelay) {
          // Parse duration string like "60s"
          const match = detail.retryDelay.match(/(\d+)s/);
          if (match) {
            return parseInt(match[1], 10) * 1000;
          }
        }
      }
    }

    return undefined;
  }
}
