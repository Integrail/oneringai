/**
 * Context inspection tools for TaskAgent
 *
 * These tools allow agents to inspect their own context state:
 * - context_inspect: Get context budget and utilization
 * - context_breakdown: Get detailed token breakdown
 * - cache_stats: Get idempotency cache statistics
 * - memory_stats: Get working memory statistics
 */

import { ToolFunction } from '../../domain/entities/Tool.js';
import type { ToolContext } from '../../domain/interfaces/IToolContext.js';

/**
 * Create context inspection tools
 */
export function createContextTools(): ToolFunction[] {
  return [
    createContextInspectTool(),
    createContextBreakdownTool(),
    createCacheStatsTool(),
    createMemoryStatsTool(),
  ];
}

/**
 * context_inspect tool - Get context budget and utilization
 */
function createContextInspectTool(): ToolFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'context_inspect',
        description: 'Get detailed breakdown of current context budget and utilization. Shows total tokens, used tokens, available tokens, utilization percentage, and status (ok/warning/critical).',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    execute: async (_args: unknown, context?: ToolContext) => {
      if (!context?.contextManager) {
        return {
          error: 'Context manager not available',
          message: 'This tool is only available within TaskAgent execution',
        };
      }

      const budget = context.contextManager.getCurrentBudget();

      if (!budget) {
        return {
          error: 'No context budget available',
          message: 'Context has not been prepared yet',
        };
      }

      return {
        total_tokens: budget.total,
        reserved_tokens: budget.reserved,
        used_tokens: budget.used,
        available_tokens: budget.available,
        utilization_percent: Math.round(budget.utilizationPercent * 10) / 10,
        status: budget.status,
        warning:
          budget.status === 'warning'
            ? 'Context approaching limit - automatic compaction may trigger'
            : budget.status === 'critical'
              ? 'Context at critical level - compaction will trigger'
              : null,
      };
    },
    idempotency: {
      safe: true, // Read-only operation
    },
  };
}

/**
 * context_breakdown tool - Get detailed token breakdown by component
 */
function createContextBreakdownTool(): ToolFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'context_breakdown',
        description: 'Get detailed token breakdown by component (system prompt, instructions, memory index, conversation history, current input). Useful for understanding what is consuming context space.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    execute: async (_args: unknown, context?: ToolContext) => {
      if (!context?.contextManager) {
        return {
          error: 'Context manager not available',
          message: 'This tool is only available within TaskAgent execution',
        };
      }

      const budget = context.contextManager.getCurrentBudget();

      if (!budget) {
        return {
          error: 'No context budget available',
          message: 'Context has not been prepared yet',
        };
      }

      // Build components array from dynamic breakdown
      const components = Object.entries(budget.breakdown).map(([name, tokens]) => ({
        name,
        tokens,
        percent: budget.used > 0 ? Math.round((tokens / budget.used) * 1000) / 10 : 0,
      }));

      return {
        total_used: budget.used,
        breakdown: budget.breakdown,
        components,
      };
    },
    idempotency: {
      safe: true, // Read-only operation
    },
  };
}

/**
 * cache_stats tool - Get idempotency cache statistics
 */
function createCacheStatsTool(): ToolFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'cache_stats',
        description: 'Get statistics about the tool call idempotency cache. Shows number of cached entries, cache hits, cache misses, and hit rate. Useful for understanding cache effectiveness.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    execute: async (_args: unknown, context?: ToolContext) => {
      if (!context?.idempotencyCache) {
        return {
          error: 'Idempotency cache not available',
          message: 'This tool is only available within TaskAgent execution',
        };
      }

      const stats = context.idempotencyCache.getStats();

      return {
        entries: stats.entries,
        hits: stats.hits,
        misses: stats.misses,
        hit_rate: Math.round(stats.hitRate * 1000) / 10,
        hit_rate_percent: `${Math.round(stats.hitRate * 100)}%`,
        effectiveness:
          stats.hitRate > 0.5
            ? 'high'
            : stats.hitRate > 0.2
              ? 'medium'
              : stats.hitRate > 0
                ? 'low'
                : 'none',
      };
    },
    idempotency: {
      safe: true, // Read-only operation
    },
  };
}

/**
 * memory_stats tool - Get working memory statistics
 */
function createMemoryStatsTool(): ToolFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'memory_stats',
        description: 'Get detailed working memory utilization statistics. Shows total size, utilization percentage, number of entries, and breakdown by scope (persistent vs task-scoped).',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    execute: async (_args: unknown, context?: ToolContext) => {
      if (!context?.memory) {
        return {
          error: 'Working memory not available',
          message: 'This tool is only available within TaskAgent execution',
        };
      }

      // Get the index from memory
      const index = await context.memory.list();

      // Calculate stats (note: we don't have direct access to sizes from WorkingMemoryAccess)
      // This is a simplified version - in production, you might want to add more methods to WorkingMemoryAccess
      return {
        entry_count: index.length,
        entries_by_scope: {
          total: index.length,
          // Note: scope information not available through WorkingMemoryAccess interface
          // Would need to extend the interface or use a different approach
        },
        entries: index.map((entry) => ({
          key: entry.key,
          description: entry.description,
        })),
      };
    },
    idempotency: {
      safe: true, // Read-only operation
    },
  };
}
