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
export type { IContextPlugin } from './IContextPlugin.js';
export { BaseContextPlugin } from './IContextPlugin.js';

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

export { AutoSpillPlugin } from './AutoSpillPlugin.js';
export type {
  SpilledEntry,
  AutoSpillConfig,
  SerializedAutoSpillState,
  AutoSpillEvents,
} from './AutoSpillPlugin.js';

// ToolResultEviction plugin - smart eviction of old tool results to memory
export { ToolResultEvictionPlugin } from './ToolResultEvictionPlugin.js';
export type {
  TrackedResult,
  ToolResultEvictionConfig,
  SerializedToolResultEvictionState,
  ToolResultEvictionEvents,
  EvictionResult,
} from './ToolResultEvictionPlugin.js';

// InContextMemory plugin - stores key-value pairs directly in context
export { InContextMemoryPlugin } from './InContextMemoryPlugin.js';
export type {
  InContextEntry,
  InContextPriority,
  InContextMemoryConfig,
  SerializedInContextMemoryState,
} from './InContextMemoryPlugin.js';

// InContextMemory tools and factory functions
// Note: context_get was removed since InContextMemory values are visible directly in context
export {
  createInContextMemoryTools,
  createInContextMemory,
  setupInContextMemory,
  contextSetDefinition,
  contextDeleteDefinition,
  contextListDefinition,
} from './inContextMemoryTools.js';

// PersistentInstructions plugin - stores custom instructions on disk
export { PersistentInstructionsPlugin } from './PersistentInstructionsPlugin.js';
export type {
  PersistentInstructionsConfig,
  SerializedPersistentInstructionsState,
} from './PersistentInstructionsPlugin.js';

// PersistentInstructions tools and factory functions
export {
  createPersistentInstructionsTools,
  createPersistentInstructions,
  setupPersistentInstructions,
  instructionsSetDefinition,
  instructionsAppendDefinition,
  instructionsGetDefinition,
  instructionsClearDefinition,
} from './persistentInstructionsTools.js';
