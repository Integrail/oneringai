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
// Plugins - Extend context with custom components
// ============================================================================

export {
  // Base class
  BaseContextPlugin,
  // Built-in plugins
  PlanPlugin,
  MemoryPlugin,
  ToolOutputPlugin,
  AutoSpillPlugin,
} from './plugins/index.js';

// Type exports
export type {
  IContextPlugin,
  SerializedPlanPluginState,
  SerializedMemoryPluginState,
  ToolOutput,
  SerializedToolOutputState,
  ToolOutputPluginConfig,
  SpilledEntry,
  AutoSpillConfig,
  SerializedAutoSpillState,
  AutoSpillEvents,
} from './plugins/index.js';

// ============================================================================
// SmartCompactor - LLM-powered intelligent context compaction
// ============================================================================

export { SmartCompactor, createSmartCompactor } from './SmartCompactor.js';
export type {
  SmartCompactorConfig,
  SmartCompactionResult,
  CompactionSummary,
  SpilledData,
} from './SmartCompactor.js';

