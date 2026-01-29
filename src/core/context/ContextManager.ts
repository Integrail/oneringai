/**
 * ContextManager - Universal context management with strategy support
 */

import { EventEmitter } from 'eventemitter3';
import type {
  IContextProvider,
  ITokenEstimator,
  IContextCompactor,
  IContextStrategy,
  ContextManagerConfig,
  ContextBudget,
  PreparedContext,
  IContextComponent,
} from './types.js';
import { DEFAULT_CONTEXT_CONFIG } from './types.js';
import { createStrategy as createStrategyFn } from './strategies/index.js';
import { estimateComponentTokens } from './utils/ContextUtils.js';

/**
 * Context manager events
 */
export interface ContextManagerEvents {
  compacting: { reason: string; currentBudget: ContextBudget; strategy: string };
  compacted: { log: string[]; newBudget: ContextBudget; tokensFreed: number };
  budget_warning: { budget: ContextBudget };
  budget_critical: { budget: ContextBudget };
  strategy_switched: { from: string; to: string; reason: string };
}

/**
 * Universal Context Manager
 *
 * Works with any agent type through the IContextProvider interface.
 * Supports multiple compaction strategies that can be switched at runtime.
 */
export class ContextManager extends EventEmitter<ContextManagerEvents> {
  private config: ContextManagerConfig;
  private provider: IContextProvider;
  private estimator: ITokenEstimator;
  private compactors: IContextCompactor[];
  private strategy: IContextStrategy;
  private lastBudget?: ContextBudget;

  constructor(
    provider: IContextProvider,
    config: Partial<ContextManagerConfig> = {},
    compactors: IContextCompactor[] = [],
    estimator?: ITokenEstimator,
    strategy?: IContextStrategy
  ) {
    super();
    this.provider = provider;
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    this.compactors = compactors.sort((a, b) => a.priority - b.priority);

    // Create or use provided estimator
    if (estimator) {
      this.estimator = estimator;
    } else if (typeof this.config.estimator === 'string') {
      // Import and create estimator dynamically
      this.estimator = this.createEstimator(this.config.estimator);
    } else {
      this.estimator = this.config.estimator;
    }

    // Create or use provided strategy
    if (strategy) {
      this.strategy = strategy;
    } else {
      this.strategy = this.createStrategy(this.config.strategy || 'proactive');
    }
  }

  /**
   * Prepare context for LLM call
   * Returns prepared components, automatically compacting if needed
   */
  async prepare(): Promise<PreparedContext> {
    // Get components from provider
    let components = await this.provider.getComponents();

    // Let strategy pre-process if needed
    if (this.strategy.prepareComponents) {
      components = await this.strategy.prepareComponents(components);
    }

    // Calculate budget
    let budget = this.calculateBudget(components);
    this.lastBudget = budget;

    // Emit warnings
    if (budget.status === 'warning') {
      this.emit('budget_warning', { budget });
    } else if (budget.status === 'critical') {
      this.emit('budget_critical', { budget });
    }

    // Check if compaction needed (strategy decides)
    const needsCompaction =
      this.config.autoCompact && this.strategy.shouldCompact(budget, this.config);

    if (needsCompaction) {
      return await this.compactWithStrategy(components, budget);
    }

    return {
      components,
      budget,
      compacted: false,
    };
  }

  /**
   * Compact using the current strategy
   */
  private async compactWithStrategy(
    components: IContextComponent[],
    budget: ContextBudget
  ): Promise<PreparedContext> {
    this.emit('compacting', {
      reason: `Context at ${budget.utilizationPercent.toFixed(1)}%`,
      currentBudget: budget,
      strategy: this.strategy.name,
    });

    // Let strategy handle compaction
    const result = await this.strategy.compact(components, budget, this.compactors, this.estimator);

    // Post-process if strategy needs it
    let finalComponents = result.components;
    if (this.strategy.postProcess) {
      finalComponents = await this.strategy.postProcess(result.components, budget);
    }

    // Recalculate budget
    const newBudget = this.calculateBudget(finalComponents);

    // Check if compaction was sufficient
    if (newBudget.status === 'critical') {
      throw new Error(
        `Cannot fit context within limits after compaction (strategy: ${this.strategy.name}). ` +
          `Used: ${newBudget.used}, Limit: ${budget.total - budget.reserved}`
      );
    }

    this.emit('compacted', {
      log: result.log,
      newBudget,
      tokensFreed: result.tokensFreed,
    });

    // Apply compacted components back to provider
    await this.provider.applyCompactedComponents(finalComponents);

    return {
      components: finalComponents,
      budget: newBudget,
      compacted: true,
      compactionLog: result.log,
    };
  }

  /**
   * Calculate budget for components
   */
  private calculateBudget(components: IContextComponent[]): ContextBudget {
    const breakdown: Record<string, number> = {};
    let used = 0;

    for (const component of components) {
      const tokens = this.estimateComponent(component);
      breakdown[component.name] = tokens;
      used += tokens;
    }

    const total = this.provider.getMaxContextSize();
    const reserved = Math.floor(total * this.config.responseReserve);
    const available = total - reserved - used;
    const utilizationRatio = (used + reserved) / total;
    const utilizationPercent = (used / (total - reserved)) * 100;

    let status: 'ok' | 'warning' | 'critical';
    if (utilizationRatio >= this.config.hardLimit) {
      status = 'critical';
    } else if (utilizationRatio >= this.config.compactionThreshold) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      total,
      reserved,
      used,
      available,
      utilizationPercent,
      status,
      breakdown,
    };
  }

  /**
   * Estimate tokens for a component
   */
  private estimateComponent(component: IContextComponent): number {
    return estimateComponentTokens(component, this.estimator);
  }

  /**
   * Switch to a different strategy at runtime
   */
  setStrategy(
    strategy: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive' | IContextStrategy
  ): void {
    const oldStrategy = this.strategy.name;
    this.strategy = typeof strategy === 'string' ? this.createStrategy(strategy) : strategy;

    this.emit('strategy_switched', {
      from: oldStrategy,
      to: this.strategy.name,
      reason: 'manual',
    });
  }

  /**
   * Get current strategy
   */
  getStrategy(): IContextStrategy {
    return this.strategy;
  }

  /**
   * Get strategy metrics
   */
  getStrategyMetrics(): Record<string, unknown> {
    return this.strategy.getMetrics?.() ?? {};
  }

  /**
   * Get current budget
   */
  getCurrentBudget(): ContextBudget | null {
    return this.lastBudget ?? null;
  }

  /**
   * Get configuration
   */
  getConfig(): ContextManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Add compactor
   */
  addCompactor(compactor: IContextCompactor): void {
    this.compactors.push(compactor);
    this.compactors.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get all compactors
   */
  getCompactors(): IContextCompactor[] {
    return [...this.compactors];
  }

  /**
   * Create estimator from name
   */
  private createEstimator(_name: string): ITokenEstimator {
    // For now, just return approximate estimator
    // We can enhance this later if needed
    return {
      estimateTokens: (text: string) => {
        if (!text || text.length === 0) return 0;
        return Math.ceil(text.length / 4);
      },
      estimateDataTokens: (data: unknown) => {
        const serialized = JSON.stringify(data);
        return Math.ceil(serialized.length / 4);
      },
    };
  }

  /**
   * Create strategy from name or config
   */
  private createStrategy(strategy: string | IContextStrategy): IContextStrategy {
    if (typeof strategy !== 'string') {
      return strategy;
    }

    // Use imported factory function
    return createStrategyFn(strategy, this.config.strategyOptions || {});
  }
}
