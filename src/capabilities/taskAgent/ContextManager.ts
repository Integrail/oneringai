/**
 * ContextManager - manages context window size and compaction
 */

import EventEmitter from 'eventemitter3';

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  /** Model's max context tokens */
  maxContextTokens: number;

  /** Trigger compaction at this % of max */
  compactionThreshold: number;

  /** Hard limit - must compact before LLM call */
  hardLimit: number;

  /** Reserve space for response */
  responseReserve: number;

  /** Token estimator method */
  tokenEstimator: 'approximate' | 'tiktoken';
}

/**
 * Compaction strategy configuration
 */
export interface CompactionStrategy {
  /** Priority order for compaction */
  priority: Array<'toolOutputs' | 'history' | 'memory'>;

  /** Strategy for history compaction */
  historyStrategy: 'summarize' | 'truncate' | 'sliding-window';

  /** Strategy for memory eviction */
  memoryStrategy: 'lru' | 'largest-first' | 'oldest-first';

  /** Max tokens for tool outputs */
  toolOutputMaxSize: number;
}

/**
 * Context components that make up the full context
 */
export interface ContextComponents {
  systemPrompt: string;
  instructions: string;
  memoryIndex: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentInput: string;
}

/**
 * Context budget breakdown
 */
export interface ContextBudget {
  total: number;
  reserved: number;
  used: number;
  available: number;
  utilizationPercent: number;
  status: 'ok' | 'warning' | 'critical';
  breakdown: {
    systemPrompt: number;
    instructions: number;
    memoryIndex: number;
    conversationHistory: number;
    currentInput: number;
  };
}

/**
 * Prepared context result
 */
export interface PreparedContext {
  components: ContextComponents;
  budget: ContextBudget;
  compacted: boolean;
  compactionLog?: string[];
}

/**
 * Memory manager interface (for compaction)
 */
export interface IMemoryManager {
  evictLRU(count: number): Promise<string[]>;
  formatIndex?(): Promise<string>;
  getIndex?(): Promise<{ entries: any[] }>;
}

/**
 * History manager interface (for compaction)
 */
export interface IHistoryManager {
  summarize(): Promise<void>;
  truncate?(messages: any[], limit: number): Promise<any[]>;
}

/**
 * Default configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig = {
  maxContextTokens: 128000,
  compactionThreshold: 0.75,
  hardLimit: 0.9,
  responseReserve: 0.15,
  tokenEstimator: 'approximate',
};

/**
 * Default compaction strategy
 */
export const DEFAULT_COMPACTION_STRATEGY: CompactionStrategy = {
  priority: ['toolOutputs', 'history', 'memory'],
  historyStrategy: 'summarize',
  memoryStrategy: 'lru',
  toolOutputMaxSize: 4000,
};

export interface ContextManagerEvents {
  compacting: { reason: string };
  compacted: { log: string[] };
}

/**
 * ContextManager handles context window management.
 *
 * Features:
 * - Token estimation (approximate or tiktoken)
 * - Proactive compaction before overflow
 * - Configurable compaction strategies
 * - Tool output truncation
 */
export class ContextManager extends EventEmitter<ContextManagerEvents> {
  private config: ContextManagerConfig;
  private strategy: CompactionStrategy;

  constructor(
    config: ContextManagerConfig = DEFAULT_CONTEXT_CONFIG,
    strategy: CompactionStrategy = DEFAULT_COMPACTION_STRATEGY
  ) {
    super();
    this.config = config;
    this.strategy = strategy;
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    if (this.config.tokenEstimator === 'approximate') {
      // Approximate: 1 token ≈ 4 characters
      return Math.ceil(text.length / 4);
    }

    // TODO: Implement tiktoken when needed
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate budget for context components
   */
  estimateBudget(components: ContextComponents): ContextBudget {
    const breakdown = {
      systemPrompt: this.estimateTokens(components.systemPrompt),
      instructions: this.estimateTokens(components.instructions),
      memoryIndex: this.estimateTokens(components.memoryIndex),
      conversationHistory: components.conversationHistory.reduce(
        (sum, msg) => sum + this.estimateTokens(msg.content),
        0
      ),
      currentInput: this.estimateTokens(components.currentInput),
    };

    const used = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    const total = this.config.maxContextTokens;
    const reserved = Math.floor(total * this.config.responseReserve);
    const available = total - reserved - used;
    const utilizationPercent = (used / (total - reserved)) * 100;

    // Calculate utilization including reserve
    // We need to ensure there's enough space for the response
    const utilizationRatio = (used + reserved) / total;

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
   * Prepare context, compacting if necessary
   */
  async prepareContext(
    components: ContextComponents,
    memory: IMemoryManager,
    history: IHistoryManager
  ): Promise<PreparedContext> {
    let current = { ...components };
    let budget = this.estimateBudget(current);

    // If under threshold, no compaction needed
    if (budget.status === 'ok') {
      return { components: current, budget, compacted: false };
    }

    // Need to compact
    this.emit('compacting', { reason: `Context at ${budget.utilizationPercent.toFixed(1)}%` });

    const log: string[] = [];

    // Compact according to strategy priority
    // Keep compacting until we're under threshold or run out of options
    let compactionRound = 0;
    const maxRounds = 3; // Prevent infinite loops

    while (budget.status !== 'ok' && compactionRound < maxRounds) {
      compactionRound++;
      let didCompact = false;

      for (const target of this.strategy.priority) {
        budget = this.estimateBudget(current);

        if (budget.status === 'ok') {
          break; // Compacted enough
        }

        switch (target) {
          case 'toolOutputs':
            // Truncate large tool outputs in conversation history
            if (current.conversationHistory.length > 0) {
              const before = JSON.stringify(current);
              current = this.truncateToolOutputsInHistory(current);
              if (JSON.stringify(current) !== before) {
                log.push(`Truncated tool outputs to ${this.strategy.toolOutputMaxSize} tokens`);
                didCompact = true;
              }
            }
            break;

          case 'history':
            // Compact history
            if (current.conversationHistory.length > 0) {
              if (this.strategy.historyStrategy === 'truncate') {
                // Keep only recent messages, more aggressive each round
                const keepRatio = Math.max(0.2, 1 - compactionRound * 0.3);
                const maxMessages = Math.max(1, Math.floor(current.conversationHistory.length * keepRatio));
                const before = current.conversationHistory.length;
                current.conversationHistory = current.conversationHistory.slice(-maxMessages);
                if (current.conversationHistory.length < before) {
                  log.push(`Truncated history to ${maxMessages} messages`);
                  didCompact = true;
                }
              } else {
                // Summarize (placeholder - would need LLM call)
                await history.summarize();
                log.push('Summarized conversation history');
                didCompact = true;
              }
            }
            break;

          case 'memory':
            // Evict memory entries
            // Default to assuming some entries exist if we can't check
            const entryCount = memory.getIndex ? (await memory.getIndex()).entries.length : 4;
            const evictCount = Math.max(1, Math.ceil(entryCount * 0.25));

            if (evictCount > 0) {
              const evicted = await memory.evictLRU(evictCount);
              if (evicted.length > 0) {
                log.push(`Evicted ${evicted.length} memory entries: ${evicted.join(', ')}`);
                didCompact = true;

                // Update memory index in context if method available
                if (memory.formatIndex) {
                  current.memoryIndex = await memory.formatIndex();
                }
              }
            }
            break;
        }
      }

      // If we didn't compact anything this round, no point continuing
      if (!didCompact) {
        break;
      }
    }

    budget = this.estimateBudget(current);

    // Only throw if we're significantly over capacity (>5% over)
    // Small overages are acceptable after best-effort compaction
    const totalCapacity = budget.total - budget.reserved;
    const overage = budget.used - totalCapacity;
    const overagePercent = (overage / totalCapacity) * 100;

    if (overage > 0 && overagePercent > 5) {
      throw new Error(
        `Cannot fit context within limits after compaction. Used: ${budget.used}, Available: ${totalCapacity} (${overagePercent.toFixed(1)}% over)`
      );
    }

    this.emit('compacted', { log });

    return { components: current, budget, compacted: true, compactionLog: log };
  }

  /**
   * Truncate tool outputs in conversation history
   */
  private truncateToolOutputsInHistory(components: ContextComponents): ContextComponents {
    const truncated = { ...components };
    truncated.conversationHistory = components.conversationHistory.map((msg) => {
      const tokens = this.estimateTokens(msg.content);
      if (tokens > this.strategy.toolOutputMaxSize) {
        // Truncate the content
        const maxChars = this.strategy.toolOutputMaxSize * 4;
        return {
          ...msg,
          content: msg.content.substring(0, maxChars) + '\n[truncated...]',
        };
      }
      return msg;
    });
    return truncated;
  }

  /**
   * Truncate tool output to fit within limit
   */
  truncateToolOutput(output: unknown, maxTokens: number): unknown {
    const serialized = JSON.stringify(output);
    const tokens = this.estimateTokens(serialized);

    if (tokens <= maxTokens) {
      return output;
    }

    // Create truncated version
    return {
      _truncated: true,
      _summary: this.createOutputSummary(output, maxTokens),
      _originalSize: `${tokens} tokens`,
    };
  }

  /**
   * Create summary of large output
   */
  createOutputSummary(output: unknown, maxTokens: number): string {
    if (output === null) return 'null';
    if (output === undefined) return 'undefined';

    if (Array.isArray(output)) {
      const firstItem = output[0];
      const keys = firstItem && typeof firstItem === 'object' ? Object.keys(firstItem) : [];
      return `Array with ${output.length} items${keys.length > 0 ? `, first item keys: ${keys.join(', ')}` : ''}`;
    }

    if (typeof output === 'object') {
      const keys = Object.keys(output);
      return `Object with ${keys.length} keys: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? ` ... and ${keys.length - 10} more` : ''}`;
    }

    if (typeof output === 'string') {
      const maxChars = maxTokens * 4;
      return output.length > maxChars ? output.substring(0, maxChars) + '...' : output;
    }

    return String(output);
  }

  /**
   * Check if output should be auto-stored in memory
   */
  shouldAutoStore(output: unknown, threshold: number): boolean {
    const serialized = JSON.stringify(output);
    const tokens = this.estimateTokens(serialized);
    return tokens > threshold;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
