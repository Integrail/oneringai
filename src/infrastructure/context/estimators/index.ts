/**
 * Token estimators
 */

import type { ITokenEstimator } from '../../../core/context/types.js';
import { ApproximateTokenEstimator } from './ApproximateEstimator.js';

/**
 * Create token estimator from name
 */
export function createEstimator(name: string): ITokenEstimator {
  switch (name) {
    case 'approximate':
      return new ApproximateTokenEstimator();
    case 'tiktoken':
      // TODO: Implement tiktoken-based estimator when needed
      throw new Error('Tiktoken estimator not yet implemented. Use "approximate" for now.');
    default:
      throw new Error(`Unknown token estimator: ${name}`);
  }
}

export { ApproximateTokenEstimator };
