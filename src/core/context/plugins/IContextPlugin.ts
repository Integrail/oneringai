/**
 * IContextPlugin - Interface for context plugins
 *
 * Plugins extend AgentContext with custom context components.
 * Built-in plugins: PlanPlugin, MemoryPlugin, ToolOutputPlugin
 * Users can create custom plugins for domain-specific context.
 */

import type { IContextComponent, ITokenEstimator, ContextBudget } from '../types.js';

/**
 * Context plugin interface
 *
 * Plugins add custom components to the context (e.g., Plan, Memory, Tool Outputs).
 * Each plugin is responsible for:
 * - Providing its context component
 * - Handling compaction when space is needed
 * - Serializing/restoring state for sessions
 */
export interface IContextPlugin {
  /**
   * Unique name for this plugin (used as component name)
   * Should be lowercase with underscores (e.g., 'plan', 'memory_index', 'tool_outputs')
   */
  readonly name: string;

  /**
   * Compaction priority (higher number = compact first)
   * - 0: Never compact (system_prompt, instructions, current_input)
   * - 1-3: Critical (plan, core instructions)
   * - 4-7: Important (conversation history)
   * - 8-10: Expendable (memory index, tool outputs)
   */
  readonly priority: number;

  /**
   * Whether this plugin's content can be compacted
   * If false, the component will never be reduced
   */
  readonly compactable: boolean;

  /**
   * Get this plugin's context component
   * Return null if plugin has no content for this turn
   *
   * @returns The component to include in context, or null if none
   */
  getComponent(): Promise<IContextComponent | null>;

  /**
   * Called when this plugin's content needs compaction
   * Plugin is responsible for reducing its size to fit within budget
   *
   * @param targetTokens - Target token count to reduce to (approximate)
   * @param estimator - Token estimator to use for calculations
   * @returns Number of tokens actually freed
   */
  compact?(targetTokens: number, estimator: ITokenEstimator): Promise<number>;

  /**
   * Called after context is prepared (opportunity for cleanup/logging)
   * Can be used to track context usage metrics
   *
   * @param budget - The final context budget after preparation
   */
  onPrepared?(budget: ContextBudget): Promise<void>;

  /**
   * Called when the context manager is being destroyed/cleaned up
   * Use for releasing resources
   */
  destroy?(): void;

  /**
   * Get state for session serialization
   * Return undefined if plugin has no state to persist
   */
  getState?(): unknown;

  /**
   * Restore from serialized state
   * Called when resuming a session
   *
   * @param state - Previously serialized state from getState()
   */
  restoreState?(state: unknown): void;
}

/**
 * Base class for context plugins with common functionality
 * Plugins can extend this or implement IContextPlugin directly
 */
export abstract class BaseContextPlugin implements IContextPlugin {
  abstract readonly name: string;
  abstract readonly priority: number;
  abstract readonly compactable: boolean;

  abstract getComponent(): Promise<IContextComponent | null>;

  // Default implementations - override as needed
  async compact(_targetTokens: number, _estimator: ITokenEstimator): Promise<number> {
    return 0; // No compaction by default
  }

  async onPrepared(_budget: ContextBudget): Promise<void> {
    // No-op by default
  }

  destroy(): void {
    // No-op by default
  }

  getState(): unknown {
    return undefined;
  }

  restoreState(_state: unknown): void {
    // No-op by default
  }
}
