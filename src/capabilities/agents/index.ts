/**
 * Agents capability exports
 */

export { AgentManager } from './AgentManager.js';
export { Agent } from './Agent.js';
export { ToolRegistry } from './ToolRegistry.js';
export { AgenticLoop } from './AgenticLoop.js';
export { ExecutionContext } from './ExecutionContext.js';
export { HookManager } from './HookManager.js';

export type { AgentConfig } from './Agent.js';
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
