/**
 * Aggressive Compaction Strategy
 *
 * - Compacts earlier (60% threshold instead of 75%)
 * - Targets lower usage (50% instead of 65%)
 * - More aggressive per-component reduction
 * - Good for: Long-running agents, constrained context
 */

import type {
  IContextStrategy,
  IContextComponent,
  ContextBudget,
  ContextManagerConfig,
  IContextCompactor,
  ITokenEstimator,
} from '../types.js';

export interface AggressiveStrategyOptions {
  /** Threshold to trigger compaction (default: 0.60) */
  threshold?: number;
  /** Target utilization after compaction (default: 0.50) */
  target?: number;
}

export class AggressiveCompactionStrategy implements IContextStrategy {
  readonly name = 'aggressive';

  constructor(private options: AggressiveStrategyOptions = {}) {}

  shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean {
    const threshold = this.options.threshold ?? 0.6; // Compact at 60%
    const utilizationRatio = (budget.used + budget.reserved) / budget.total;
    return utilizationRatio >= threshold;
  }

  async compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise<{ components: IContextComponent[]; log: string[]; tokensFreed: number }> {
    const log: string[] = [];
    let current = [...components];

    const target = this.options.target ?? 0.5; // Target 50%
    const targetUsage = Math.floor(budget.total * target);
    const tokensToFree = budget.used - targetUsage;

    let freedTokens = 0;

    // Sort by priority
    const sortedComponents = current
      .filter((c) => c.compactable)
      .sort((a, b) => b.priority - a.priority);

    for (const component of sortedComponents) {
      if (freedTokens >= tokensToFree) break;

      const compactor = compactors.find((c) => c.canCompact(component));
      if (!compactor) continue;

      const beforeSize = this.estimateComponent(component, estimator);

      // More aggressive: target 30% of original size
      const targetSize = Math.floor(beforeSize * 0.3);

      const compacted = await compactor.compact(component, targetSize);

      const index = current.findIndex((c) => c.name === component.name);
      current[index] = compacted;

      const afterSize = this.estimateComponent(compacted, estimator);
      const saved = beforeSize - afterSize;
      freedTokens += saved;

      log.push(`Aggressive: ${compactor.name} compacted "${component.name}" by ${saved} tokens`);
    }

    return { components: current, log, tokensFreed: freedTokens };
  }

  private estimateComponent(component: IContextComponent, estimator: ITokenEstimator): number {
    if (typeof component.content === 'string') {
      return estimator.estimateTokens(component.content);
    }
    return estimator.estimateDataTokens(component.content);
  }
}
