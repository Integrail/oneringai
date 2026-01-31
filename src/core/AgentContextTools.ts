/**
 * AgentContextTools - Feature-aware tool factory for AgentContext
 *
 * @deprecated Since v0.3.0 - Tools are now auto-registered by AgentContext constructor.
 * All agent types (Agent, TaskAgent, UniversalAgent) automatically get feature-aware
 * tools based on enabled features. Manual registration is no longer needed.
 *
 * This file is kept for backwards compatibility only. If you were calling
 * getAgentContextTools() manually, you can safely remove that code.
 *
 * Consolidated tools (Phase 1):
 * - Always: context_stats (unified introspection)
 * - memory: memory_store, memory_retrieve, memory_delete, memory_query, memory_cleanup_raw
 * - inContextMemory: context_set, context_delete, context_list
 * - persistentInstructions: instructions_set, instructions_append, instructions_get, instructions_clear
 */

import type { ToolFunction } from '../domain/entities/Tool.js';
import type { AgentContext } from './AgentContext.js';

// Import individual tool creators (consolidated)
import {
  createMemoryStoreTool,
  createMemoryRetrieveTool,
  createMemoryDeleteTool,
  createMemoryQueryTool,
  createMemoryCleanupRawTool,
} from '../capabilities/taskAgent/memoryTools.js';

import {
  createContextStatsTool,
} from '../capabilities/taskAgent/contextTools.js';

/**
 * Get tools based on enabled features in AgentContext
 *
 * @deprecated Tools are now auto-registered by AgentContext constructor.
 * You no longer need to call this function manually. All agent types
 * automatically get the correct tools based on enabled features.
 *
 * @param context - The AgentContext to get tools for
 * @returns Array of tools based on enabled features
 */
export function getAgentContextTools(context: AgentContext): ToolFunction[] {
  const tools: ToolFunction[] = [];

  // Always available (consolidated introspection)
  tools.push(createContextStatsTool());

  // Memory feature includes consolidated memory tools
  if (context.isFeatureEnabled('memory')) {
    tools.push(createMemoryStoreTool());
    tools.push(createMemoryRetrieveTool());
    tools.push(createMemoryDeleteTool());
    tools.push(createMemoryQueryTool());
    tools.push(createMemoryCleanupRawTool());
  }

  // Note: InContextMemory tools (context_set, context_delete, context_list)
  // and PersistentInstructions tools are handled directly in AgentContext constructor

  return tools;
}

/**
 * Get only the basic introspection tools (always available)
 */
export function getBasicIntrospectionTools(): ToolFunction[] {
  return [createContextStatsTool()];
}

/**
 * Get only memory-related tools (requires memory feature)
 */
export function getMemoryTools(): ToolFunction[] {
  return [
    createMemoryStoreTool(),
    createMemoryRetrieveTool(),
    createMemoryDeleteTool(),
    createMemoryQueryTool(),
    createMemoryCleanupRawTool(),
  ];
}
