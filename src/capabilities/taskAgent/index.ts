/**
 * TaskAgent utilities - Reusable components (TaskAgent class removed)
 *
 * NOTE: TaskAgent has been deleted. Only reusable utilities remain:
 * - WorkingMemory: Generic indexed memory storage
 * - ExternalDependencyHandler: Webhook/polling handlers
 * - CheckpointManager: State checkpointing
 * - PlanningAgent: Plan generation utility
 */

export { WorkingMemory } from './WorkingMemory.js';
export type { WorkingMemoryEvents, EvictionStrategy } from './WorkingMemory.js';

export { ExternalDependencyHandler } from './ExternalDependencyHandler.js';
export type { ExternalDependencyEvents } from './ExternalDependencyHandler.js';

export { CheckpointManager, DEFAULT_CHECKPOINT_STRATEGY } from './CheckpointManager.js';
export type { CheckpointStrategy } from './CheckpointManager.js';

export { PlanningAgent, generateSimplePlan } from './PlanningAgent.js';
export type { PlanningAgentConfig, GeneratedPlan } from './PlanningAgent.js';
