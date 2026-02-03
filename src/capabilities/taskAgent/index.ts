/**
 * TaskAgent capability exports
 *
 * NOTE: ContextManager and HistoryManager are now unified in core:
 * - Use ContextManager from '@oneringai/agents' (core/context)
 * - Use ConversationHistoryManager from '@oneringai/agents' (core/history)
 */

export { TaskAgent } from './TaskAgent.js';
export type {
  TaskAgentConfig,
  TaskAgentSessionConfig,
  TaskAgentHooks,
  TaskAgentEvents,
  AgentHandle,
  PlanResult,
  PlanUpdates,
  PlanUpdateOptions,
  TaskContext,
  TaskResult,
  ErrorContext,
} from './TaskAgent.js';

export { WorkingMemory } from './WorkingMemory.js';
export type { WorkingMemoryEvents, EvictionStrategy } from './WorkingMemory.js';

// ContextManager is now unified in core/context/ContextManager.ts
// HistoryManager is now unified in core/history/ConversationHistoryManager.ts

export { IdempotencyCache } from './IdempotencyCache.js';
export type { IdempotencyCacheConfig, CacheStats } from './IdempotencyCache.js';
export { DEFAULT_IDEMPOTENCY_CONFIG } from './IdempotencyCache.js';

export { ExternalDependencyHandler } from './ExternalDependencyHandler.js';
export type { ExternalDependencyEvents } from './ExternalDependencyHandler.js';

export { PlanExecutor } from './PlanExecutor.js';
export type { PlanExecutorConfig, PlanExecutorEvents, PlanExecutionResult } from './PlanExecutor.js';

export { CheckpointManager } from './CheckpointManager.js';
export type { CheckpointStrategy } from './CheckpointManager.js';
export { DEFAULT_CHECKPOINT_STRATEGY } from './CheckpointManager.js';

// Memory tools (individual creators for feature-aware registration)
// Consolidated tools (Phase 1): memory_query replaces memory_list + memory_retrieve_batch
export {
  createMemoryTools,
  createMemoryStoreTool,
  createMemoryRetrieveTool,
  createMemoryDeleteTool,
  createMemoryQueryTool,
  createMemoryCleanupRawTool,
  createAutoSpillProcessTool,
  memoryStoreDefinition,
  memoryRetrieveDefinition,
  memoryDeleteDefinition,
  memoryQueryDefinition,
  memoryCleanupRawDefinition,
  autospillProcessDefinition,
} from './memoryTools.js';

// Context inspection and management tools (individual creators for feature-aware registration)
// Consolidated tools:
//   - context_stats: unified introspection (replaces context_inspect + context_breakdown + cache_stats + memory_stats)
//   - context_compact: LLM-powered smart compaction (Phase 4)
export {
  createContextTools,
  createContextStatsTool,
  createContextCompactTool,
  contextStatsDefinition,
  contextCompactDefinition,
  // Legacy tools (deprecated but kept for backward compatibility)
  createContextInspectTool,
  createContextBreakdownTool,
  createCacheStatsTool,
  createMemoryStatsTool,
} from './contextTools.js';

export { PlanningAgent } from './PlanningAgent.js';
export type { PlanningAgentConfig, GeneratedPlan } from './PlanningAgent.js';
export { generateSimplePlan } from './PlanningAgent.js';
