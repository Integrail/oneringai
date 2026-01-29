/**
 * Approximate Token Estimator
 *
 * Uses content-type aware heuristics:
 * - Code: ~3 chars/token (more symbols, shorter words)
 * - Prose: ~4 chars/token (natural language)
 * - Mixed: ~3.5 chars/token
 *
 * Fast and good enough for most use cases.
 */

import type { ITokenEstimator, TokenContentType } from '../../../core/context/types.js';

export class ApproximateTokenEstimator implements ITokenEstimator {
  /**
   * Estimate tokens for text with content-type awareness
   *
   * @param text - The text to estimate tokens for
   * @param contentType - Type of content:
   *   - 'code': Code is typically denser (~3 chars/token)
   *   - 'prose': Natural language text (~4 chars/token)
   *   - 'mixed': Mix of code and prose (~3.5 chars/token)
   */
  estimateTokens(text: string, contentType: TokenContentType = 'mixed'): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Content-type aware estimation
    const charsPerToken = contentType === 'code' ? 3 : contentType === 'prose' ? 4 : 3.5;
    return Math.ceil(text.length / charsPerToken);
  }

  /**
   * Estimate tokens for structured data (always uses 'mixed' estimation)
   */
  estimateDataTokens(data: unknown, contentType: TokenContentType = 'mixed'): number {
    if (data === null || data === undefined) {
      return 1;
    }

    // Serialize and estimate
    try {
      const serialized = JSON.stringify(data);
      return this.estimateTokens(serialized, contentType);
    } catch {
      // If serialization fails, return a conservative estimate
      return 100;
    }
  }
}
