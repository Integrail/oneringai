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
  TaskAgentContextAccess,
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
