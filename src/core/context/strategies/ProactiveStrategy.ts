/**
 * Proactive Compaction Strategy
 *
 * - Monitors context budget continuously
 * - Compacts proactively when reaching warning/critical threshold
 * - Uses multi-round compaction with increasing aggressiveness
 * - Follows priority-based compaction order
 *
 * Good for: General purpose, balanced approach
 */

import type { ContextBudget, ContextManagerConfig } from '../types.js';
import { BaseCompactionStrategy } from './BaseCompactionStrategy.js';

/**
 * Options for ProactiveCompactionStrategy
 */
export interface ProactiveStrategyOptions {
  /** Target utilization after compaction (default: 0.65) */
  targetUtilization?: number;
  /** Base reduction factor for round 1 (default: 0.50) */
  baseReductionFactor?: number;
  /** Reduction step per round (default: 0.15) */
  reductionStep?: number;
  /** Maximum compaction rounds (default: 3) */
  maxRounds?: number;
}

/**
 * Default options for proactive strategy
 */
const DEFAULT_OPTIONS: Required<ProactiveStrategyOptions> = {
  targetUtilization: 0.65,
  baseReductionFactor: 0.50,
  reductionStep: 0.15,
  maxRounds: 3,
};

export class ProactiveCompactionStrategy extends BaseCompactionStrategy {
  readonly name = 'proactive';
  private options: Required<ProactiveStrategyOptions>;

  constructor(options: ProactiveStrategyOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean {
    // Compact when we hit warning or critical
    return budget.status === 'warning' || budget.status === 'critical';
  }

  calculateTargetSize(beforeSize: number, round: number): number {
    // More aggressive in later rounds: 50%, 35%, 20%
    const reductionFactor =
      this.options.baseReductionFactor - (round - 1) * this.options.reductionStep;
    return Math.floor(beforeSize * Math.max(reductionFactor, 0.1)); // Never below 10%
  }

  getTargetUtilization(): number {
    return this.options.targetUtilization;
  }

  protected getMaxRounds(): number {
    return this.options.maxRounds;
  }

  protected getLogPrefix(): string {
    return 'Proactive';
  }
}
