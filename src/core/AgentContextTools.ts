/**
 * AgentContextTools - Feature-aware tool factory for AgentContext
 *
 * Provides tools based on enabled features. When a feature is disabled,
 * its associated tools are not included (cleaner LLM tool list).
 *
 * Features and their tools:
 * - memory: memory_store, memory_retrieve, memory_delete, memory_list,
 *           memory_cleanup_raw, memory_retrieve_batch, memory_stats, cache_stats
 * - inContextMemory: context_set, context_get, context_delete, context_list
 *   (handled in AgentContext constructor)
 *
 * Always available (basic introspection):
 * - context_inspect, context_breakdown
 */

import type { ToolFunction } from '../domain/entities/Tool.js';
import type { AgentContext } from './AgentContext.js';

// Import individual tool creators
import {
  createMemoryStoreTool,
  createMemoryRetrieveTool,
  createMemoryDeleteTool,
  createMemoryListTool,
  createMemoryCleanupRawTool,
  createMemoryRetrieveBatchTool,
} from '../capabilities/taskAgent/memoryTools.js';

import {
  createContextInspectTool,
  createContextBreakdownTool,
  createCacheStatsTool,
  createMemoryStatsTool,
} from '../capabilities/taskAgent/contextTools.js';

/**
 * Get tools based on enabled features in AgentContext
 *
 * @param context - The AgentContext to get tools for
 * @returns Array of tools based on enabled features
 *
 * @example
 * ```typescript
 * const ctx = AgentContext.create({
 *   model: 'gpt-4',
 *   features: { memory: true, inContextMemory: false }
 * });
 * const tools = getAgentContextTools(ctx);
 * for (const tool of tools) {
 *   ctx.tools.register(tool);
 * }
 * ```
 */
export function getAgentContextTools(context: AgentContext): ToolFunction[] {
  const tools: ToolFunction[] = [];

  // Always available (basic introspection)
  tools.push(createContextInspectTool());
  tools.push(createContextBreakdownTool());

  // Memory feature includes both WorkingMemory tools AND cache_stats
  if (context.isFeatureEnabled('memory')) {
    // Memory tools
    tools.push(createMemoryStoreTool());
    tools.push(createMemoryRetrieveTool());
    tools.push(createMemoryDeleteTool());
    tools.push(createMemoryListTool());
    tools.push(createMemoryCleanupRawTool());
    tools.push(createMemoryRetrieveBatchTool());

    // Memory stats tool
    tools.push(createMemoryStatsTool());

    // Cache stats tool (cache is part of memory feature)
    tools.push(createCacheStatsTool());
  }

  // Note: InContextMemory tools (context_set, context_get, context_delete, context_list)
  // are handled directly in AgentContext constructor when inContextMemory feature is enabled

  return tools;
}

/**
 * Get only the basic introspection tools (always available)
 */
export function getBasicIntrospectionTools(): ToolFunction[] {
  return [createContextInspectTool(), createContextBreakdownTool()];
}

/**
 * Get only memory-related tools (requires memory feature)
 */
export function getMemoryTools(): ToolFunction[] {
  return [
    createMemoryStoreTool(),
    createMemoryRetrieveTool(),
    createMemoryDeleteTool(),
    createMemoryListTool(),
    createMemoryCleanupRawTool(),
    createMemoryRetrieveBatchTool(),
    createMemoryStatsTool(),
    createCacheStatsTool(),
  ];
}
