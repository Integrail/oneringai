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
} from './ContextManager.js';
export { DEFAULT_CONTEXT_CONFIG, DEFAULT_COMPACTION_STRATEGY } from './ContextManager.js';

export { IdempotencyCache } from './IdempotencyCache.js';
export type { IdempotencyCacheConfig, CacheStats } from './IdempotencyCache.js';
export { DEFAULT_IDEMPOTENCY_CONFIG } from './IdempotencyCache.js';

export { createMemoryTools } from './memoryTools.js';
export {
  memoryStoreDefinition,
  memoryRetrieveDefinition,
  memoryDeleteDefinition,
  memoryListDefinition,
} from './memoryTools.js';
