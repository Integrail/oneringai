/**
 * Core context management module
 *
 * Architecture Overview:
 * ======================
 *
 * For most users, import `AgentContext` from the main package:
 *   import { AgentContext } from '@oneringai/agents';
 *
 * AgentContext is the "swiss army knife" facade that composes:
 * - ToolManager (tool registration, execution, circuit breakers)
 * - WorkingMemory (key-value store with eviction)
 * - IdempotencyCache (tool result caching)
 * - ToolPermissionManager (approval workflow)
 * - Built-in history tracking
 *
 * For Advanced Usage:
 * - ContextManager: Strategy-based context preparation (used internally by TaskAgent)
 * - Plugins: Extend context with custom components
 *
 * @example
 * ```typescript
 * // Simple API (recommended for most users)
 * import { AgentContext } from '@oneringai/agents';
 *
 * const ctx = AgentContext.create({ model: 'gpt-4', tools: [myTool] });
 * ctx.addMessage('user', 'Hello');
 * await ctx.executeTool('my_tool', { arg: 'value' });
 *
 * // Advanced: Custom context strategies (for specialized agents)
 * import { ContextManager } from '@oneringai/agents/context';
 * ```
 */

// Types
export * from './types.js';

// ============================================================================
// Advanced API - Strategy-based Context Management
// ============================================================================

/**
 * ContextManager - Strategy-based context preparation for LLM calls.
 *
 * Used internally by TaskAgent for advanced context management with
 * multiple compaction strategies (proactive, aggressive, lazy, etc.).
 *
 * For most users, use `AgentContext` from the main package instead.
 */
export { ContextManager } from './ContextManager.js';

// ============================================================================
// Plugins - Extend context with custom components
// ============================================================================

export {
  // Interface
  IContextPlugin,
  BaseContextPlugin,
  // Built-in plugins
  PlanPlugin,
  MemoryPlugin,
  ToolOutputPlugin,
  // Plugin types
  type SerializedPlanPluginState,
  type SerializedMemoryPluginState,
  type ToolOutput,
  type SerializedToolOutputState,
  type ToolOutputPluginConfig,
} from './plugins/index.js';

