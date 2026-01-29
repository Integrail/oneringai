/**
 * Lazy Compaction Strategy
 *
 * - Only compacts when absolutely necessary (critical status)
 * - Minimal compaction (just enough to fit, targets 85%)
 * - Preserves as much context as possible (70% reduction factor)
 * - Single-round compaction
 *
 * Good for: High-context models, short conversations, when context preservation is critical
 */

import type { ContextBudget, ContextManagerConfig } from '../types.js';
import { BaseCompactionStrategy } from './BaseCompactionStrategy.js';

/**
 * Options for LazyCompactionStrategy
 */
export interface LazyStrategyOptions {
  /** Target utilization after compaction (default: 0.85) */
  targetUtilization?: number;
  /** Reduction factor - target this fraction of original size (default: 0.70) */
  reductionFactor?: number;
}

/**
 * Default options for lazy strategy
 */
const DEFAULT_OPTIONS: Required<LazyStrategyOptions> = {
  targetUtilization: 0.85,
  reductionFactor: 0.70,
};

export class LazyCompactionStrategy extends BaseCompactionStrategy {
  readonly name = 'lazy';
  private options: Required<LazyStrategyOptions>;

  constructor(options: LazyStrategyOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean {
    // Only compact when critical
    return budget.status === 'critical';
  }

  calculateTargetSize(beforeSize: number, _round: number): number {
    // Minimal reduction: 70% of original
    return Math.floor(beforeSize * this.options.reductionFactor);
  }

  getTargetUtilization(): number {
    return this.options.targetUtilization;
  }

  protected getLogPrefix(): string {
    return 'Lazy';
  }
}
