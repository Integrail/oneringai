/**
 * Context inspection tools for TaskAgent
 *
 * Consolidated tool (Phase 1):
 * - context_stats: Unified context introspection with configurable sections
 *
 * Legacy tools preserved for backward compatibility but not actively registered:
 * - context_inspect → context_stats({ sections: ["budget"] })
 * - context_breakdown → context_stats({ sections: ["breakdown"] })
 * - cache_stats → context_stats({ sections: ["cache"] })
 * - memory_stats → context_stats({ sections: ["memory"] })
 */

import { ToolFunction, FunctionToolDefinition } from '../../domain/entities/Tool.js';
import type { ToolContext } from '../../domain/interfaces/IToolContext.js';
import { getTierFromKey } from '../../domain/entities/Memory.js';

// ============================================================================
// Consolidated Tool Definition
// ============================================================================

/**
 * Tool definition for context_stats (consolidated introspection)
 */
export const contextStatsDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'context_stats',
    description: `Get comprehensive context statistics and health metrics.

Examples:
- context_stats() → budget summary (used/total/remaining tokens)
- context_stats({ sections: ["breakdown"] }) → token breakdown by component
- context_stats({ sections: ["memory"] }) → memory stats (entries, tiers)
- context_stats({ sections: ["cache"] }) → cache stats (hits, misses)
- context_stats({ sections: ["all"] }) → everything`,
    parameters: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['budget', 'breakdown', 'memory', 'cache', 'all'],
          },
          description: 'Sections to include. Default: ["budget"]',
        },
      },
      required: [],
    },
  },
};

// ============================================================================
// Consolidated Tool Creator
// ============================================================================

/**
 * Create context_stats tool (consolidated introspection)
 * Always available - gracefully handles disabled features
 */
export function createContextStatsTool(): ToolFunction {
  return {
    definition: contextStatsDefinition,
    execute: async (args: Record<string, unknown>, context?: ToolContext) => {
      const agentCtx = context?.agentContext;
      if (!agentCtx) {
        return {
          error: 'AgentContext not available',
          message: 'Tool context missing agentContext',
        };
      }

      const requestedSections = (args.sections as string[] | undefined) ?? ['budget'];
      const sections = new Set(
        requestedSections.includes('all')
          ? ['budget', 'breakdown', 'memory', 'cache']
          : requestedSections
      );

      const result: Record<string, unknown> = {};

      // Budget section (always available)
      if (sections.has('budget')) {
        const budget = agentCtx.getLastBudget();
        if (!budget) {
          result.budget = {
            status: 'no_budget_data',
            message: 'No context budget calculated yet. Run prepare() first.',
          };
        } else {
          result.budget = {
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
        }
      }

      // Breakdown section (always available)
      if (sections.has('breakdown')) {
        const budget = agentCtx.getLastBudget();
        if (!budget) {
          result.breakdown = {
            status: 'no_budget_data',
            message: 'No context budget calculated yet. Run prepare() first.',
          };
        } else {
          const components = Object.entries(budget.breakdown).map(([name, tokens]) => ({
            name,
            tokens,
            percent: budget.used > 0 ? Math.round((tokens / budget.used) * 1000) / 10 : 0,
          }));

          result.breakdown = {
            total_used: budget.used,
            by_component: budget.breakdown,
            components,
          };
        }
      }

      // Memory section (requires memory feature)
      if (sections.has('memory')) {
        if (!context?.memory) {
          result.memory = {
            status: 'feature_disabled',
            message: 'Memory feature is not enabled.',
          };
        } else {
          const entries = await context.memory.list();

          // Count by tier
          const byTier: Record<string, number> = {};
          for (const entry of entries) {
            const tier = getTierFromKey(entry.key) ?? 'other';
            byTier[tier] = (byTier[tier] || 0) + 1;
          }

          result.memory = {
            total_entries: entries.length,
            by_tier: byTier,
            entries: entries.map((e) => ({
              key: e.key,
              description: e.description,
              priority: e.effectivePriority ?? 'normal',
            })),
          };
        }
      }

      // Cache section (requires memory feature - cache is part of memory)
      if (sections.has('cache')) {
        if (!context?.idempotencyCache) {
          result.cache = {
            status: 'feature_disabled',
            message: 'Cache is not enabled (requires memory feature).',
          };
        } else {
          const stats = context.idempotencyCache.getStats();
          result.cache = {
            entries: stats.entries,
            hits: stats.hits,
            misses: stats.misses,
            hit_rate_percent: Math.round(stats.hitRate * 100),
            effectiveness:
              stats.hitRate > 0.5
                ? 'high'
                : stats.hitRate > 0.2
                  ? 'medium'
                  : stats.hitRate > 0
                    ? 'low'
                    : 'none',
          };
        }
      }

      return result;
    },
    idempotency: { safe: true },
    output: { expectedSize: 'small' },
    describeCall: (args) => {
      const sections = args.sections as string[] | undefined;
      if (!sections || sections.length === 0) return 'budget';
      if (sections.includes('all')) return 'all';
      return sections.join('+');
    },
  };
}

// ============================================================================
// Legacy Tool Creators (preserved for backward compatibility)
// These are no longer actively registered but kept for any direct imports
// ============================================================================

/**
 * @deprecated Use createContextStatsTool() instead
 * context_inspect tool - Get context budget and utilization
 */
export function createContextInspectTool(): ToolFunction {
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
      const agentCtx = context?.agentContext;
      if (!agentCtx) {
        return {
          error: 'AgentContext not available',
          message: 'Tool context missing agentContext',
        };
      }

      const budget = agentCtx.getLastBudget();

      if (!budget) {
        return {
          status: 'no_budget_data',
          message: 'No context budget calculated yet. Run prepare() first.',
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
      safe: true,
    },
  };
}

/**
 * @deprecated Use createContextStatsTool() instead
 * context_breakdown tool - Get detailed token breakdown by component
 */
export function createContextBreakdownTool(): ToolFunction {
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
      const agentCtx = context?.agentContext;
      if (!agentCtx) {
        return {
          error: 'AgentContext not available',
          message: 'Tool context missing agentContext',
        };
      }

      const budget = agentCtx.getLastBudget();

      if (!budget) {
        return {
          status: 'no_budget_data',
          message: 'No context budget calculated yet. Run prepare() first.',
        };
      }

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
      safe: true,
    },
  };
}

/**
 * @deprecated Use createContextStatsTool() instead
 * cache_stats tool - Get idempotency cache statistics
 */
export function createCacheStatsTool(): ToolFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'cache_stats',
        description: 'Get statistics about the tool call idempotency cache.',
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
      safe: true,
    },
  };
}

/**
 * @deprecated Use createContextStatsTool() instead
 * memory_stats tool - Get working memory statistics
 */
export function createMemoryStatsTool(): ToolFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'memory_stats',
        description: 'Get detailed working memory utilization statistics.',
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

      const index = await context.memory.list();

      return {
        entry_count: index.length,
        entries_by_scope: {
          total: index.length,
        },
        entries: index.map((entry) => ({
          key: entry.key,
          description: entry.description,
        })),
      };
    },
    idempotency: {
      safe: true,
    },
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create all context inspection tools (backward compatibility)
 *
 * Consolidated tools (Phase 1):
 * - context_stats: Unified context introspection with configurable sections
 *
 * Note: For feature-aware tool registration, AgentContext._registerFeatureTools()
 * now registers context_stats directly.
 */
export function createContextTools(): ToolFunction[] {
  return [
    createContextStatsTool(),
  ];
}
