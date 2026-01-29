/**
 * Agents capability exports (internal)
 *
 * Note: The main Agent class is now in src/core/Agent.ts
 * This module exports internal implementation details.
 * Tool management is unified in src/core/ToolManager.ts
 */

// Internal implementation
export { AgenticLoop } from './AgenticLoop.js';
export { ExecutionContext } from './ExecutionContext.js';
export { HookManager } from './HookManager.js';
export type { AgenticLoopConfig } from './AgenticLoop.js';
export type { HistoryMode, ExecutionMetrics, AuditEntry } from './ExecutionContext.js';

// Event types
export type {
  AgenticLoopEvents,
  AgenticLoopEventName,
  ExecutionStartEvent,
  ExecutionCompleteEvent,
  ToolStartEvent,
  ToolCompleteEvent,
  LLMRequestEvent,
  LLMResponseEvent,
} from './types/EventTypes.js';

// Hook types
export type {
  HookConfig,
  HookName,
  Hook,
  ModifyingHook,
  BeforeToolContext,
  AfterToolContext,
  ApproveToolContext,
  ToolModification,
  ApprovalResult,
} from './types/HookTypes.js';
