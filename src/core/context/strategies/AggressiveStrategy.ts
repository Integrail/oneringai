/**
 * Aggressive Compaction Strategy
 *
 * - Compacts earlier (60% threshold instead of 75%)
 * - Targets lower usage (50% instead of 65%)
 * - More aggressive per-component reduction (30%)
 * - Single-round compaction
 *
 * Good for: Long-running agents, constrained context windows
 */

import type { ContextBudget, ContextManagerConfig } from '../types.js';
import { BaseCompactionStrategy } from './BaseCompactionStrategy.js';

/**
 * Options for AggressiveCompactionStrategy
 */
export interface AggressiveStrategyOptions {
  /** Threshold to trigger compaction (default: 0.60) */
  threshold?: number;
  /** Target utilization after compaction (default: 0.50) */
  targetUtilization?: number;
  /** Reduction factor - target this fraction of original size (default: 0.30) */
  reductionFactor?: number;
}

/**
 * Default options for aggressive strategy
 */
const DEFAULT_OPTIONS: Required<AggressiveStrategyOptions> = {
  threshold: 0.60,
  targetUtilization: 0.50,
  reductionFactor: 0.30,
};

export class AggressiveCompactionStrategy extends BaseCompactionStrategy {
  readonly name = 'aggressive';
  private options: Required<AggressiveStrategyOptions>;

  constructor(options: AggressiveStrategyOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean {
    const utilizationRatio = (budget.used + budget.reserved) / budget.total;
    return utilizationRatio >= this.options.threshold;
  }

  calculateTargetSize(beforeSize: number, _round: number): number {
    // Aggressive: target 30% of original size
    return Math.floor(beforeSize * this.options.reductionFactor);
  }

  getTargetUtilization(): number {
    return this.options.targetUtilization;
  }

  protected getLogPrefix(): string {
    return 'Aggressive';
  }
}
