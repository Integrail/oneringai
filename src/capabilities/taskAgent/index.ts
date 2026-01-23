/**
 * TaskAgent capability exports
 */

export { TaskAgent } from './TaskAgent.js';
export type {
  TaskAgentConfig,
  TaskAgentHooks,
  TaskAgentEvents,
  AgentHandle,
  PlanResult,
  PlanUpdates,
  TaskContext,
  TaskResult,
  ErrorContext,
} from './TaskAgent.js';

export { WorkingMemory } from './WorkingMemory.js';
export type { WorkingMemoryEvents } from './WorkingMemory.js';

export { ContextManager } from './ContextManager.js';
export type {
  ContextManagerConfig,
  ContextComponents,
  ContextBudget,
  CompactionStrategy,
  PreparedContext,
  IHistoryManager,
  IMemoryManager,
} from './ContextManager.js';
export { DEFAULT_CONTEXT_CONFIG, DEFAULT_COMPACTION_STRATEGY } from './ContextManager.js';

export { IdempotencyCache } from './IdempotencyCache.js';
export type { IdempotencyCacheConfig, CacheStats } from './IdempotencyCache.js';
export { DEFAULT_IDEMPOTENCY_CONFIG } from './IdempotencyCache.js';

export { HistoryManager } from './HistoryManager.js';
export type { HistoryManagerConfig } from './HistoryManager.js';
export { DEFAULT_HISTORY_CONFIG } from './HistoryManager.js';

export { ExternalDependencyHandler } from './ExternalDependencyHandler.js';
export type { ExternalDependencyEvents } from './ExternalDependencyHandler.js';

export { PlanExecutor } from './PlanExecutor.js';
export type { PlanExecutorConfig, PlanExecutorEvents, PlanExecutionResult } from './PlanExecutor.js';

export { CheckpointManager } from './CheckpointManager.js';
export type { CheckpointStrategy } from './CheckpointManager.js';
export { DEFAULT_CHECKPOINT_STRATEGY } from './CheckpointManager.js';

export { createMemoryTools } from './memoryTools.js';
export {
  memoryStoreDefinition,
  memoryRetrieveDefinition,
  memoryDeleteDefinition,
  memoryListDefinition,
} from './memoryTools.js';

export { createContextTools } from './contextTools.js';

export { PlanningAgent } from './PlanningAgent.js';
export type { PlanningAgentConfig, GeneratedPlan } from './PlanningAgent.js';
export { generateSimplePlan } from './PlanningAgent.js';
