/**
 * Proactive Compaction Strategy
 *
 * - Monitors context budget continuously
 * - Compacts proactively when reaching threshold
 * - Follows priority-based compaction order
 */

import type {
  IContextStrategy,
  IContextComponent,
  ContextBudget,
  ContextManagerConfig,
  IContextCompactor,
  ITokenEstimator,
} from '../types.js';

export class ProactiveCompactionStrategy implements IContextStrategy {
  readonly name = 'proactive';

  private metrics = {
    compactionCount: 0,
    totalTokensFreed: 0,
    avgTokensFreedPerCompaction: 0,
  };

  shouldCompact(budget: ContextBudget, _config: ContextManagerConfig): boolean {
    // Compact when we hit warning or critical
    return budget.status === 'warning' || budget.status === 'critical';
  }

  async compact(
    components: IContextComponent[],
    budget: ContextBudget,
    compactors: IContextCompactor[],
    estimator: ITokenEstimator
  ): Promise<{ components: IContextComponent[]; log: string[]; tokensFreed: number }> {
    const log: string[] = [];
    let current = [...components];

    // Calculate target - aim for 65% to give breathing room
    const targetUsage = Math.floor(budget.total * 0.65);
    const tokensToFree = budget.used - targetUsage;

    let freedTokens = 0;
    let round = 0;
    const maxRounds = 3;

    // Sort components by priority (higher = compact first)
    const sortedComponents = current
      .filter((c) => c.compactable)
      .sort((a, b) => b.priority - a.priority);

    while (freedTokens < tokensToFree && round < maxRounds) {
      round++;
      let roundFreed = 0;

      for (const component of sortedComponents) {
        if (freedTokens >= tokensToFree) break;

        // Find compactor for this component
        const compactor = compactors.find((c) => c.canCompact(component));
        if (!compactor) continue;

        // Estimate current size
        const beforeSize = this.estimateComponent(component, estimator);

        // Calculate target size (more aggressive in later rounds)
        const reductionFactor = 0.5 - (round - 1) * 0.15; // 50%, 35%, 20%
        const targetSize = Math.floor(beforeSize * reductionFactor);

        // Compact
        const compacted = await compactor.compact(component, targetSize);

        // Update component
        const index = current.findIndex((c) => c.name === component.name);
        current[index] = compacted;

        // Track savings
        const afterSize = this.estimateComponent(compacted, estimator);
        const saved = beforeSize - afterSize;
        freedTokens += saved;
        roundFreed += saved;

        log.push(
          `Round ${round}: ${compactor.name} compacted "${component.name}" by ${saved} tokens`
        );
      }

      // If we didn't free anything this round, stop
      if (roundFreed === 0) break;
    }

    // Update metrics
    this.metrics.compactionCount++;
    this.metrics.totalTokensFreed += freedTokens;
    this.metrics.avgTokensFreedPerCompaction =
      this.metrics.totalTokensFreed / this.metrics.compactionCount;

    return { components: current, log, tokensFreed: freedTokens };
  }

  private estimateComponent(component: IContextComponent, estimator: ITokenEstimator): number {
    if (typeof component.content === 'string') {
      return estimator.estimateTokens(component.content);
    }
    return estimator.estimateDataTokens(component.content);
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
