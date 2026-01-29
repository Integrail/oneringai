/**
 * BaseCompactionStrategy - Abstract base class for compaction strategies
 *
 * Provides shared implementation of the compaction loop via template method pattern.
 * Concrete strategies only need to implement:
 * - shouldCompact() - when to trigger compaction
 * - calculateTargetSize() - how aggressively to compact each component
 * - getTargetUtilization() - what utilization to aim for after compaction
 */

import type {
  IContextStrategy,
  IContextComponent,
  ContextBudget,
  ContextManagerConfig,
  IContextCompactor,
  ITokenEstimator,
} from '../types.js';
import { executeCompactionLoop, type CompactionResult } from '../utils/ContextUtils.js';

/**
 * Base metrics tracked by all strategies.
 * Includes index signature to satisfy IContextStrategy.getMetrics() return type.
 */
export interface BaseStrategyMetrics extends Record<string, unknown> {
  compactionCount: number;
  totalTokensFreed: number;
  avgTokensFreedPerCompaction: number;
}

/**
 * Abstract base class for compaction strategies.
 *
 * Uses template method pattern - subclasses implement abstract methods
 * while base class provides the common compaction loop.
 */
export abstract class BaseCompactionStrategy implements IContextStrategy {
  abstract readonly name: string;

  protected metrics: BaseStrategyMetrics = {
    compactionCount: 0,
    totalTokensFreed: 0,
    avgTokensFreedPerCompaction: 0,
  };

  /**
   * Determine if compaction should be triggered.
   * Each strategy has different thresholds.
   */
  abstract shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean;

  /**
   * Calculate target size for a component during compaction.
   *
   * @param beforeSize - Current token count of the component
   * @param round - Current compaction round (1-based)
   * @returns Target token count after compaction
   */
  abstract calculateTargetSize(beforeSize: number, round: number): number;

  /**
   * Get the target utilization ratio after compaction (0-1).
   * Used to calculate how many tokens need to be freed.
   */
  abstract getTargetUtilization(): number;

  /**
   * Get the maximum number of compaction rounds.
   * Override in subclasses for multi-round strategies.
   */
  protected getMaxRounds(): number {
    return 1;
  }

  /**
   * Get the log prefix for compaction messages.
   * Override to customize logging.
   */
  protected getLogPrefix(): string {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1);
  }

  /**
   * Compact components to fit within budget.
   * Uses the shared compaction loop with strategy-specific target calculation.
   */
  async compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise<CompactionResult> {
    // Calculate how many tokens we need to free
    const targetUsage = Math.floor(budget.total * this.getTargetUtilization());
    const tokensToFree = budget.used - targetUsage;

    // Execute the shared compaction loop
    const result = await executeCompactionLoop({
      components,
      tokensToFree,
      compactors,
      estimator,
      calculateTargetSize: this.calculateTargetSize.bind(this),
      maxRounds: this.getMaxRounds(),
      logPrefix: this.getLogPrefix(),
    });

    // Update metrics
    this.updateMetrics(result.tokensFreed);

    return result;
  }

  /**
   * Update internal metrics after compaction
   */
  protected updateMetrics(tokensFreed: number): void {
    this.metrics.compactionCount++;
    this.metrics.totalTokensFreed += tokensFreed;
    this.metrics.avgTokensFreedPerCompaction =
      this.metrics.totalTokensFreed / this.metrics.compactionCount;
  }

  /**
   * Get strategy metrics
   */
  getMetrics(): BaseStrategyMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      compactionCount: 0,
      totalTokensFreed: 0,
      avgTokensFreedPerCompaction: 0,
    };
  }
}
