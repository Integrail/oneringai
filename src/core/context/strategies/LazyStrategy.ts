/**
 * Lazy Compaction Strategy
 *
 * - Only compacts when absolutely necessary (>90%)
 * - Minimal compaction (just enough to fit)
 * - Preserves as much context as possible
 * - Good for: High-context models, short conversations
 */

import type {
  IContextStrategy,
  IContextComponent,
  ContextBudget,
  ContextManagerConfig,
  IContextCompactor,
  ITokenEstimator,
} from '../types.js';

export class LazyCompactionStrategy implements IContextStrategy {
  readonly name = 'lazy';

  shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean {
    // Only compact when critical
    return budget.status === 'critical';
  }

  async compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise<{ components: IContextComponent[]; log: string[]; tokensFreed: number }> {
    const log: string[] = [];
    let current = [...components];

    // Only free enough to get under hard limit
    const targetUsage = Math.floor(budget.total * 0.85); // Target 85%
    const tokensToFree = budget.used - targetUsage;

    let freedTokens = 0;

    // Sort by priority
    const sortedComponents = current
      .filter((c) => c.compactable)
      .sort((a, b) => b.priority - a.priority);

    for (const component of sortedComponents) {
      if (freedTokens >= tokensToFree) break; // Stop as soon as we have enough

      const compactor = compactors.find((c) => c.canCompact(component));
      if (!compactor) continue;

      const beforeSize = this.estimateComponent(component, estimator);

      // Minimal reduction: 70% of original
      const targetSize = Math.floor(beforeSize * 0.7);

      const compacted = await compactor.compact(component, targetSize);

      const index = current.findIndex((c) => c.name === component.name);
      current[index] = compacted;

      const afterSize = this.estimateComponent(compacted, estimator);
      const saved = beforeSize - afterSize;
      freedTokens += saved;

      log.push(`Lazy: ${compactor.name} compacted "${component.name}" by ${saved} tokens`);
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
