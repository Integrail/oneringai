/**
 * Approximate Token Estimator
 *
 * Uses simple heuristic: 1 token ≈ 4 characters
 * Fast and good enough for most use cases
 */

import type { ITokenEstimator } from '../../../core/context/types.js';

export class ApproximateTokenEstimator implements ITokenEstimator {
  /**
   * Estimate tokens for text using 4 chars per token heuristic
   */
  estimateTokens(text: string, _model?: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Approximate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate tokens for structured data
   */
  estimateDataTokens(data: unknown, _model?: string): number {
    if (data === null || data === undefined) {
      return 1;
    }

    // Serialize and estimate
    try {
      const serialized = JSON.stringify(data);
      return this.estimateTokens(serialized);
    } catch {
      // If serialization fails, return a conservative estimate
      return 100;
    }
  }
}
