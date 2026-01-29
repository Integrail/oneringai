/**
 * UnifiedContextManager - Single source of truth for all context management
 *
 * This manager unifies:
 * - System prompt and instructions (built-in, never compacted)
 * - Conversation history (built-in, compactable)
 * - Current input (built-in, never compacted)
 * - Plugins for extensibility (Plan, Memory, ToolOutputs, custom)
 *
 * All agent types use this same interface:
 * - Agent: Optional (for history tracking and budget management)
 * - TaskAgent: Required with PlanPlugin and MemoryPlugin
 * - UniversalAgent: Required with MemoryPlugin
 * - PlanningAgent: Required (minimal, for history)
 *
 * This replaces:
 * - IHistoryManager (history is now built-in)
 * - IContextProvider/TaskAgentContextProvider (use plugins instead)
 * - IContextBuilder (use UnifiedContextManager directly)
 */

import { EventEmitter } from 'eventemitter3';
import type {
  IContextComponent,
  ITokenEstimator,
  IContextStrategy,
  ContextManagerConfig,
  ContextBudget,
  PreparedContext,
  TokenContentType,
} from './types.js';
import { DEFAULT_CONTEXT_CONFIG } from './types.js';
import { createStrategy as createStrategyFactory } from './strategies/index.js';
import { estimateComponentTokens } from './utils/ContextUtils.js';
import type { IContextPlugin } from './plugins/IContextPlugin.js';

// ============================================================================
// Types
// ============================================================================

/**
 * History message (replaces import from IHistoryManager)
 */
export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * History configuration
 */
export interface HistoryConfig {
  /** Maximum messages to keep before compaction triggers */
  maxMessages: number;
  /** Number of recent messages to always preserve during compaction */
  preserveRecent: number;
  /** Compaction priority (higher = compact first) */
  compactionPriority: number;
}

/**
 * Default history configuration
 */
export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  maxMessages: 50,
  preserveRecent: 10,
  compactionPriority: 6,
};

/**
 * Configuration for UnifiedContextManager
 */
export interface UnifiedContextManagerConfig extends Partial<ContextManagerConfig> {
  /** History configuration */
  history?: Partial<HistoryConfig>;
  /** Max context tokens (overrides base config) */
  maxContextTokens?: number;
}

/**
 * Serialized context state for session persistence
 */
export interface SerializedContextState {
  version: number;
  core: {
    systemPrompt: string;
    instructions: string;
    history: HistoryMessage[];
  };
  plugins: Record<string, unknown>;
  config: {
    maxContextTokens: number;
    strategy: string;
  };
}

/**
 * Context metrics for monitoring
 */
export interface ContextMetrics {
  /** Total messages in history */
  historyMessageCount: number;
  /** Number of registered plugins */
  pluginCount: number;
  /** List of plugin names */
  pluginNames: string[];
  /** Current utilization percentage */
  utilizationPercent: number;
  /** Total compactions performed */
  compactionCount: number;
  /** Total tokens freed by compaction */
  totalTokensFreed: number;
}

/**
 * History format options
 */
export interface HistoryFormatOptions {
  /** Include message timestamps */
  includeTimestamps?: boolean;
  /** Include message metadata */
  includeMetadata?: boolean;
  /** Max messages to include (from most recent) */
  maxMessages?: number;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Events emitted by UnifiedContextManager
 */
export interface UnifiedContextManagerEvents {
  // History events
  'message:added': { message: HistoryMessage };
  'message:removed': { messageId: string };
  'history:cleared': { reason?: string };
  'history:compacted': { removedCount: number };

  // Context events
  'context:preparing': { componentCount: number };
  'context:prepared': { budget: ContextBudget; compacted: boolean };

  // Compaction events
  compacting: { reason: string; currentBudget: ContextBudget; strategy: string };
  compacted: { log: string[]; newBudget: ContextBudget; tokensFreed: number };

  // Budget events
  budget_warning: { budget: ContextBudget };
  budget_critical: { budget: ContextBudget };

  // Strategy events
  strategy_switched: { from: string; to: string; reason: string };

  // Plugin events
  'plugin:registered': { name: string };
  'plugin:unregistered': { name: string };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * UnifiedContextManager - Single source of truth for context
 */
export class UnifiedContextManager extends EventEmitter<UnifiedContextManagerEvents> {
  // ===== Built-in Core State =====
  private systemPrompt: string = '';
  private instructions: string = '';
  private history: HistoryMessage[] = [];
  private currentInput: string = '';

  // ===== Plugin System =====
  private plugins: Map<string, IContextPlugin> = new Map();

  // ===== Infrastructure =====
  private config: ContextManagerConfig;
  private historyConfig: HistoryConfig;
  private strategy: IContextStrategy;
  private estimator: ITokenEstimator;
  private maxContextTokens: number;

  // ===== Metrics =====
  private compactionCount: number = 0;
  private totalTokensFreed: number = 0;
  private lastBudget: ContextBudget | null = null;

  constructor(config: UnifiedContextManagerConfig = {}) {
    super();

    // Merge with defaults
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    this.historyConfig = { ...DEFAULT_HISTORY_CONFIG, ...config.history };
    this.maxContextTokens = config.maxContextTokens ?? this.config.maxContextTokens;

    // Create strategy
    const strategyConfig = this.config.strategy ?? 'proactive';
    this.strategy = typeof strategyConfig === 'string'
      ? this.createStrategy(strategyConfig)
      : strategyConfig;

    // Create estimator
    this.estimator = this.createEstimator(this.config.estimator ?? 'approximate');
  }

  // ============================================================================
  // Core Context Methods
  // ============================================================================

  /**
   * Set system prompt (priority 0, never compacted)
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Get system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Set instructions (priority 0, never compacted)
   */
  setInstructions(instructions: string): void {
    this.instructions = instructions;
  }

  /**
   * Get instructions
   */
  getInstructions(): string {
    return this.instructions;
  }

  /**
   * Set current input for this turn (priority 0, never compacted)
   */
  setCurrentInput(input: string): void {
    this.currentInput = input;
  }

  /**
   * Get current input
   */
  getCurrentInput(): string {
    return this.currentInput;
  }

  // ============================================================================
  // Built-in History Management
  // ============================================================================

  /**
   * Add a message to history
   */
  addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): HistoryMessage {
    const message: HistoryMessage = {
      id: this.generateId(),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };

    this.history.push(message);
    this.emit('message:added', { message });

    return message;
  }

  /**
   * Get all history messages
   */
  getHistory(): HistoryMessage[] {
    return [...this.history];
  }

  /**
   * Get recent N messages
   */
  getRecentHistory(count: number): HistoryMessage[] {
    return this.history.slice(-count);
  }

  /**
   * Clear all history
   */
  clearHistory(reason?: string): void {
    this.history = [];
    this.emit('history:cleared', { reason });
  }

  /**
   * Remove a specific message
   */
  removeMessage(messageId: string): boolean {
    const index = this.history.findIndex(m => m.id === messageId);
    if (index >= 0) {
      this.history.splice(index, 1);
      this.emit('message:removed', { messageId });
      return true;
    }
    return false;
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.history.length;
  }

  /**
   * Format history for display or debugging
   */
  formatHistory(options: HistoryFormatOptions = {}): string {
    const messages = options.maxMessages
      ? this.history.slice(-options.maxMessages)
      : this.history;

    return messages
      .map(m => {
        let line = `[${m.role}]: ${m.content}`;
        if (options.includeTimestamps) {
          line = `[${new Date(m.timestamp).toISOString()}] ${line}`;
        }
        if (options.includeMetadata && m.metadata) {
          line += ` | metadata: ${JSON.stringify(m.metadata)}`;
        }
        return line;
      })
      .join('\n');
  }

  // ============================================================================
  // Plugin System
  // ============================================================================

  /**
   * Register a plugin
   */
  registerPlugin(plugin: IContextPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    this.emit('plugin:registered', { name: plugin.name });
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.destroy?.();
      this.plugins.delete(name);
      this.emit('plugin:unregistered', { name });
      return true;
    }
    return false;
  }

  /**
   * Get a registered plugin
   */
  getPlugin<T extends IContextPlugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * List all registered plugins
   */
  listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  // ============================================================================
  // Context Preparation
  // ============================================================================

  /**
   * Prepare context for LLM call
   * Assembles all components and compacts if needed
   */
  async prepare(): Promise<PreparedContext> {
    // Build components from core + plugins
    const components = await this.buildComponents();
    this.emit('context:preparing', { componentCount: components.length });

    // Calculate budget
    let budget = this.calculateBudget(components);
    this.lastBudget = budget;

    // Emit warnings
    if (budget.status === 'warning') {
      this.emit('budget_warning', { budget });
    } else if (budget.status === 'critical') {
      this.emit('budget_critical', { budget });
    }

    // Check if compaction needed
    const needsCompaction =
      this.config.autoCompact && this.strategy.shouldCompact(budget, this.config);

    if (needsCompaction) {
      const result = await this.doCompaction(components, budget);
      this.emit('context:prepared', { budget: result.budget, compacted: true });
      return result;
    }

    this.emit('context:prepared', { budget, compacted: false });
    return { components, budget, compacted: false };
  }

  /**
   * Get current budget without full preparation
   */
  async getBudget(): Promise<ContextBudget> {
    const components = await this.buildComponents();
    return this.calculateBudget(components);
  }

  /**
   * Force compaction regardless of budget status
   */
  async compact(): Promise<PreparedContext> {
    const components = await this.buildComponents();
    const budget = this.calculateBudget(components);
    return this.doCompaction(components, budget);
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set compaction strategy
   */
  setStrategy(
    strategy: 'proactive' | 'aggressive' | 'lazy' | 'rolling-window' | 'adaptive' | IContextStrategy
  ): void {
    const oldName = this.strategy.name;
    this.strategy = typeof strategy === 'string' ? this.createStrategy(strategy) : strategy;
    this.emit('strategy_switched', {
      from: oldName,
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
   * Update configuration
   */
  updateConfig(config: Partial<UnifiedContextManagerConfig>): void {
    if (config.maxContextTokens !== undefined) {
      this.maxContextTokens = config.maxContextTokens;
    }
    if (config.history) {
      this.historyConfig = { ...this.historyConfig, ...config.history };
    }
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextManagerConfig {
    return { ...this.config };
  }

  /**
   * Get history configuration
   */
  getHistoryConfig(): HistoryConfig {
    return { ...this.historyConfig };
  }

  /**
   * Set max context tokens
   */
  setMaxContextTokens(tokens: number): void {
    this.maxContextTokens = tokens;
  }

  /**
   * Get max context tokens
   */
  getMaxContextTokens(): number {
    return this.maxContextTokens;
  }

  // ============================================================================
  // Introspection
  // ============================================================================

  /**
   * Estimate tokens for content
   */
  estimateTokens(content: string, type?: TokenContentType): number {
    return this.estimator.estimateTokens(content, type);
  }

  /**
   * Get utilization percentage
   */
  getUtilization(): number {
    return this.lastBudget?.utilizationPercent ?? 0;
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): ContextMetrics {
    return {
      historyMessageCount: this.history.length,
      pluginCount: this.plugins.size,
      pluginNames: Array.from(this.plugins.keys()),
      utilizationPercent: this.lastBudget?.utilizationPercent ?? 0,
      compactionCount: this.compactionCount,
      totalTokensFreed: this.totalTokensFreed,
    };
  }

  /**
   * Get last calculated budget
   */
  getLastBudget(): ContextBudget | null {
    return this.lastBudget;
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Get state for session persistence
   */
  getState(): SerializedContextState {
    const pluginStates: Record<string, unknown> = {};

    for (const [name, plugin] of this.plugins) {
      const state = plugin.getState?.();
      if (state !== undefined) {
        pluginStates[name] = state;
      }
    }

    return {
      version: 1,
      core: {
        systemPrompt: this.systemPrompt,
        instructions: this.instructions,
        history: this.history,
      },
      plugins: pluginStates,
      config: {
        maxContextTokens: this.maxContextTokens,
        strategy: this.strategy.name,
      },
    };
  }

  /**
   * Restore from saved state
   */
  restoreState(state: SerializedContextState): void {
    // Restore core state
    this.systemPrompt = state.core.systemPrompt || '';
    this.instructions = state.core.instructions || '';
    this.history = state.core.history || [];

    // Restore config
    if (state.config.maxContextTokens) {
      this.maxContextTokens = state.config.maxContextTokens;
    }
    if (state.config.strategy) {
      this.strategy = this.createStrategy(state.config.strategy);
    }

    // Restore plugin states
    for (const [name, pluginState] of Object.entries(state.plugins)) {
      const plugin = this.plugins.get(name);
      if (plugin?.restoreState) {
        plugin.restoreState(pluginState);
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Destroy the context manager and all plugins
   */
  destroy(): void {
    for (const plugin of this.plugins.values()) {
      plugin.destroy?.();
    }
    this.plugins.clear();
    this.history = [];
    this.removeAllListeners();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build all context components
   */
  private async buildComponents(): Promise<IContextComponent[]> {
    const components: IContextComponent[] = [];

    // System prompt (priority 0, never compact)
    if (this.systemPrompt) {
      components.push({
        name: 'system_prompt',
        content: this.systemPrompt,
        priority: 0,
        compactable: false,
      });
    }

    // Instructions (priority 0, never compact)
    if (this.instructions) {
      components.push({
        name: 'instructions',
        content: this.instructions,
        priority: 0,
        compactable: false,
      });
    }

    // Conversation history (compactable)
    if (this.history.length > 0) {
      components.push({
        name: 'conversation_history',
        content: this.formatHistoryForContext(),
        priority: this.historyConfig.compactionPriority,
        compactable: true,
        metadata: {
          messageCount: this.history.length,
          preserveRecent: this.historyConfig.preserveRecent,
        },
      });
    }

    // Current input (priority 0, never compact)
    if (this.currentInput) {
      components.push({
        name: 'current_input',
        content: this.currentInput,
        priority: 0,
        compactable: false,
      });
    }

    // Plugin components
    for (const plugin of this.plugins.values()) {
      try {
        const component = await plugin.getComponent();
        if (component) {
          components.push(component);
        }
      } catch (error) {
        // Log but don't fail - plugin errors shouldn't break context
        console.warn(`Plugin '${plugin.name}' failed to get component:`, error);
      }
    }

    return components;
  }

  /**
   * Format history for context inclusion
   */
  private formatHistoryForContext(): string {
    return this.history
      .map(m => {
        const roleLabel = m.role.charAt(0).toUpperCase() + m.role.slice(1);
        return `${roleLabel}: ${m.content}`;
      })
      .join('\n\n');
  }

  /**
   * Calculate budget for components
   */
  private calculateBudget(components: IContextComponent[]): ContextBudget {
    const breakdown: Record<string, number> = {};
    let used = 0;

    for (const component of components) {
      const tokens = estimateComponentTokens(component, this.estimator);
      breakdown[component.name] = tokens;
      used += tokens;
    }

    const total = this.maxContextTokens;
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
   * Perform compaction
   */
  private async doCompaction(
    components: IContextComponent[],
    budget: ContextBudget
  ): Promise<PreparedContext> {
    this.emit('compacting', {
      reason: `Context at ${budget.utilizationPercent.toFixed(1)}%`,
      currentBudget: budget,
      strategy: this.strategy.name,
    });

    const log: string[] = [];
    let tokensFreed = 0;
    let currentBudget = budget;

    // Sort compactable components by priority (highest first = compact first)
    const compactable = components
      .filter(c => c.compactable)
      .sort((a, b) => b.priority - a.priority);

    // Compact until we're under the warning threshold
    for (const component of compactable) {
      if (currentBudget.status === 'ok') break;

      let freed = 0;

      // Handle built-in history
      if (component.name === 'conversation_history') {
        freed = this.compactHistory();
        if (freed > 0) {
          log.push(`Compacted history: freed ~${freed} tokens`);
        }
      }
      // Handle plugins
      else {
        const plugin = this.plugins.get(component.name);
        if (plugin?.compact) {
          try {
            freed = await plugin.compact(currentBudget.available, this.estimator);
            if (freed > 0) {
              log.push(`Compacted ${component.name}: freed ~${freed} tokens`);
            }
          } catch (error) {
            console.warn(`Plugin '${plugin.name}' compaction failed:`, error);
          }
        }
      }

      tokensFreed += freed;

      // Recalculate budget
      const newComponents = await this.buildComponents();
      currentBudget = this.calculateBudget(newComponents);
    }

    // Update metrics
    this.compactionCount++;
    this.totalTokensFreed += tokensFreed;

    // Final components
    const finalComponents = await this.buildComponents();
    const finalBudget = this.calculateBudget(finalComponents);

    this.emit('compacted', {
      log,
      newBudget: finalBudget,
      tokensFreed,
    });

    // Notify plugins
    for (const plugin of this.plugins.values()) {
      await plugin.onPrepared?.(finalBudget);
    }

    return {
      components: finalComponents,
      budget: finalBudget,
      compacted: true,
      compactionLog: log,
    };
  }

  /**
   * Compact built-in history
   */
  private compactHistory(): number {
    const preserve = this.historyConfig.preserveRecent;
    const before = this.history.length;

    if (before <= preserve) {
      return 0; // Nothing to compact
    }

    // Keep only recent messages
    const removed = this.history.slice(0, -preserve);
    this.history = this.history.slice(-preserve);

    // Estimate tokens freed (rough approximation)
    const tokensFreed = removed.reduce(
      (sum, m) => sum + this.estimator.estimateTokens(m.content),
      0
    );

    this.emit('history:compacted', { removedCount: removed.length });

    return tokensFreed;
  }

  /**
   * Create strategy from name
   */
  private createStrategy(name: string): IContextStrategy {
    return createStrategyFactory(name, this.config.strategyOptions ?? {});
  }

  /**
   * Create token estimator
   */
  private createEstimator(config: ContextManagerConfig['estimator']): ITokenEstimator {
    if (typeof config === 'object') {
      return config;
    }

    // Default approximate estimator
    return {
      estimateTokens: (text: string, contentType?: TokenContentType) => {
        if (!text || text.length === 0) return 0;
        // Different ratios for different content types
        const ratio = contentType === 'code' ? 3 : contentType === 'prose' ? 4 : 3.5;
        return Math.ceil(text.length / ratio);
      },
      estimateDataTokens: (data: unknown, contentType?: TokenContentType) => {
        const serialized = JSON.stringify(data);
        const ratio = contentType === 'code' ? 3 : contentType === 'prose' ? 4 : 3.5;
        return Math.ceil(serialized.length / ratio);
      },
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
