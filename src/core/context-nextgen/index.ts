/**
 * AgentContextNextGen - Clean, Simple Context Management
 *
 * A complete rewrite of context management with:
 * - Single system message with all context components
 * - Clear separation: system | conversation | current input
 * - Compaction happens ONCE, right before LLM call
 * - Each plugin manages its own token tracking
 * - Tool pairs always removed together
 */

// Main context manager
export { AgentContextNextGen } from './AgentContextNextGen.js';

// Types
export type {
  IContextPluginNextGen,
  ITokenEstimator,
  AgentContextNextGenConfig,
  ContextFeatures,
  ContextBudget,
  PreparedContext,
  OversizedInputResult,
  IContextStorage,
  SerializedContextState,
  ContextEvents,
  PluginConfigs,
  // Compaction strategy types
  ICompactionStrategy,
  CompactionContext,
  CompactionResult,
  ConsolidationResult,
} from './types.js';

export {
  DEFAULT_FEATURES,
  DEFAULT_CONFIG,
} from './types.js';

// Base plugin class
export { BasePluginNextGen, simpleTokenEstimator } from './BasePluginNextGen.js';

// Plugins
export {
  WorkingMemoryPluginNextGen,
  InContextMemoryPluginNextGen,
  PersistentInstructionsPluginNextGen,
} from './plugins/index.js';

export type {
  WorkingMemoryPluginConfig,
  SerializedWorkingMemoryState,
  EvictionStrategy,
  InContextMemoryConfig,
  InContextEntry,
  InContextPriority,
  SerializedInContextMemoryState,
  PersistentInstructionsConfig,
  SerializedPersistentInstructionsState,
  InstructionEntry,
} from './plugins/index.js';

// Compaction strategies
export {
  DefaultCompactionStrategy,
  type DefaultCompactionStrategyConfig,
  AlgorithmicCompactionStrategy,
  type AlgorithmicCompactionStrategyConfig,
  // Strategy Registry
  StrategyRegistry,
  type StrategyClass,
  type StrategyInfo,
  type StrategyRegistryEntry,
  type StrategyRegisterOptions,
} from './strategies/index.js';
