/**
 * Context plugins for AgentContext
 *
 * Built-in plugins:
 * - PlanPlugin: Provides execution plan (TaskAgent, UniversalAgent)
 * - MemoryPlugin: Provides working memory index (TaskAgent, UniversalAgent)
 * - ToolOutputPlugin: Tracks recent tool outputs (all agents)
 *
 * Custom plugins can implement IContextPlugin for domain-specific context.
 */

// Plugin interface
export { IContextPlugin, BaseContextPlugin } from './IContextPlugin.js';

// Built-in plugins
export { PlanPlugin } from './PlanPlugin.js';
export type { SerializedPlanPluginState } from './PlanPlugin.js';

export { MemoryPlugin } from './MemoryPlugin.js';
export type { SerializedMemoryPluginState } from './MemoryPlugin.js';

export { ToolOutputPlugin } from './ToolOutputPlugin.js';
export type {
  ToolOutput,
  SerializedToolOutputState,
  ToolOutputPluginConfig,
} from './ToolOutputPlugin.js';
