/**
 * Adaptive Strategy
 *
 * - Learns from usage patterns
 * - Adjusts thresholds based on observed behavior
 * - Switches between strategies dynamically
 * - Good for: Production systems, varied workloads
 */

import type {
  IContextStrategy,
  IContextComponent,
  ContextBudget,
  ContextManagerConfig,
  IContextCompactor,
  ITokenEstimator,
} from '../types.js';
import { ProactiveCompactionStrategy } from './ProactiveStrategy.js';
import { AggressiveCompactionStrategy } from './AggressiveStrategy.js';
import { LazyCompactionStrategy } from './LazyStrategy.js';
import { ADAPTIVE_STRATEGY_DEFAULTS } from '../../constants.js';

export interface AdaptiveStrategyOptions {
  /** Number of compactions to learn from (default: 10) */
  learningWindow?: number;
  /** Compactions per minute threshold to switch to aggressive (default: 5) */
  switchThreshold?: number;
}

export class AdaptiveStrategy implements IContextStrategy {
  readonly name = 'adaptive';

  private currentStrategy: IContextStrategy;
  private metrics = {
    avgUtilization: 0,
    compactionFrequency: 0,
    lastCompactions: [] as number[],
  };

  constructor(private options: AdaptiveStrategyOptions = {}) {
    // Start with proactive
    this.currentStrategy = new ProactiveCompactionStrategy();
  }

  shouldCompact(budget: ContextBudget, config: ContextManagerConfig): boolean {
    // Update metrics
    this.updateMetrics(budget);

    // Decide if we should switch strategies
    this.maybeAdapt();

    // Delegate to current strategy
    return this.currentStrategy.shouldCompact(budget, config);
  }

  async compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise<{ components: IContextComponent[]; log: string[]; tokensFreed: number }> {
    const result = await this.currentStrategy.compact(components, budget, compactors, estimator);

    // Track compaction
    this.metrics.lastCompactions.push(Date.now());
    const window = this.options.learningWindow ?? ADAPTIVE_STRATEGY_DEFAULTS.LEARNING_WINDOW;
    if (this.metrics.lastCompactions.length > window) {
      this.metrics.lastCompactions.shift();
    }

    return {
      ...result,
      log: [`[Adaptive: using ${this.currentStrategy.name}]`, ...result.log],
    };
  }

  private updateMetrics(budget: ContextBudget): void {
    // Track average utilization using exponential moving average
    const alpha = 0.1; // EMA factor
    this.metrics.avgUtilization =
      alpha * budget.utilizationPercent + (1 - alpha) * this.metrics.avgUtilization;
  }

  private maybeAdapt(): void {
    const now = Date.now();

    // Calculate compaction frequency (compactions per minute)
    if (this.metrics.lastCompactions.length >= 2) {
      const firstCompaction = this.metrics.lastCompactions[0];
      if (firstCompaction !== undefined) {
        const timeSpan = now - firstCompaction;
        this.metrics.compactionFrequency =
          (this.metrics.lastCompactions.length / timeSpan) * 60000; // per minute
      }
    }

    // Adapt based on patterns
    const threshold = this.options.switchThreshold ?? ADAPTIVE_STRATEGY_DEFAULTS.SWITCH_THRESHOLD;

    if (this.metrics.compactionFrequency > threshold) {
      // Too frequent - switch to aggressive
      if (this.currentStrategy.name !== 'aggressive') {
        this.currentStrategy = new AggressiveCompactionStrategy();
      }
    } else if (
      this.metrics.compactionFrequency < ADAPTIVE_STRATEGY_DEFAULTS.LOW_FREQUENCY_THRESHOLD &&
      this.metrics.avgUtilization < ADAPTIVE_STRATEGY_DEFAULTS.LOW_UTILIZATION_THRESHOLD
    ) {
      // Rare compactions and low utilization - switch to lazy
      if (this.currentStrategy.name !== 'lazy') {
        this.currentStrategy = new LazyCompactionStrategy();
      }
    } else {
      // Normal - use proactive
      if (this.currentStrategy.name !== 'proactive') {
        this.currentStrategy = new ProactiveCompactionStrategy();
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentStrategy: this.currentStrategy.name,
    };
  }
}
