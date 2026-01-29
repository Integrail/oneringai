/**
 * Memory tools - built-in tools for memory manipulation
 *
 * These tools provide LLM access to the WorkingMemory system,
 * including support for hierarchical memory tiers (raw → summary → findings).
 */

import { ToolFunction, FunctionToolDefinition } from '../../domain/entities/Tool.js';
import { ToolContext } from '../../domain/interfaces/IToolContext.js';
import { ToolExecutionError } from '../../domain/errors/AIErrors.js';
import {
  TIER_PRIORITIES,
  addTierPrefix,
  getTierFromKey,
} from '../../domain/entities/Memory.js';
import type { MemoryTier, MemoryScope, MemoryPriority } from '../../domain/entities/Memory.js';

/**
 * Tool definition for memory_store
 */
export const memoryStoreDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_store',
    description: `Store data in working memory for later use. Use this to save important information from tool outputs.

TIER SYSTEM (for research/analysis tasks):
- "raw": Low priority, evicted first. Use for unprocessed data you'll summarize later.
- "summary": Normal priority. Use for processed summaries of raw data.
- "findings": High priority, kept longest. Use for final conclusions and insights.

The tier automatically sets priority and adds a key prefix (e.g., "findings.topic" for tier="findings").`,
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Namespaced key (e.g., "user.profile", "search.ai_news"). If using tier, prefix is added automatically.',
        },
        description: {
          type: 'string',
          description: 'Brief description of what this data contains (max 150 chars)',
        },
        value: {
          description: 'The data to store (can be any JSON value)',
        },
        tier: {
          type: 'string',
          enum: ['raw', 'summary', 'findings'],
          description: 'Optional: Memory tier. "raw" (low priority, evict first), "summary" (normal), "findings" (high priority, keep longest). Automatically sets key prefix and priority.',
        },
        derivedFrom: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Keys this data was derived from (for tracking data lineage, useful with tiers)',
        },
        neededForTasks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Task IDs that need this data. Data will be auto-cleaned when all tasks complete.',
        },
        scope: {
          type: 'string',
          enum: ['session', 'plan', 'persistent'],
          description: 'Optional: Lifecycle scope. "session" (default), "plan" (kept for entire plan), or "persistent" (never auto-cleaned)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'critical'],
          description: 'Optional: Override eviction priority. Ignored if tier is set (tier determines priority).',
        },
        pinned: {
          type: 'boolean',
          description: 'Optional: If true, this data will never be evicted.',
        },
      },
      required: ['key', 'description', 'value'],
    },
  },
};

/**
 * Tool definition for memory_retrieve
 */
export const memoryRetrieveDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_retrieve',
    description:
      'Retrieve full data from working memory by key. Use when you need the complete data, not just the description.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key to retrieve (include tier prefix if applicable, e.g., "findings.topic")',
        },
      },
      required: ['key'],
    },
  },
};

/**
 * Tool definition for memory_delete
 */
export const memoryDeleteDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_delete',
    description: 'Delete data from working memory to free up space.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key to delete',
        },
      },
      required: ['key'],
    },
  },
};

/**
 * Tool definition for memory_list
 */
export const memoryListDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_list',
    description: 'List all keys and their descriptions in working memory.',
    parameters: {
      type: 'object',
      properties: {
        tier: {
          type: 'string',
          enum: ['raw', 'summary', 'findings'],
          description: 'Optional: Filter to only show entries from a specific tier',
        },
      },
      required: [],
    },
  },
};

/**
 * Tool definition for memory_cleanup_raw
 */
export const memoryCleanupRawDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_cleanup_raw',
    description: 'Clean up raw tier data after creating summaries/findings. Only deletes entries with "raw." prefix.',
    parameters: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keys to delete (only raw tier entries will be deleted)',
        },
      },
      required: ['keys'],
    },
  },
};

/**
 * Tool definition for memory_retrieve_batch
 */
export const memoryRetrieveBatchDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_retrieve_batch',
    description: `Retrieve multiple memory entries at once. More efficient than multiple memory_retrieve calls.

Use this for:
- Getting all findings before synthesis: pattern="findings.*"
- Getting specific entries by keys: keys=["findings.search1", "findings.search2"]
- Getting all entries from a tier: tier="findings"

Returns all matching entries with their full values in one call.`,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob-like pattern to match keys (e.g., "findings.*", "search.*", "*"). Supports * as wildcard.',
        },
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific keys to retrieve. Use this when you know exact keys.',
        },
        tier: {
          type: 'string',
          enum: ['raw', 'summary', 'findings'],
          description: 'Retrieve all entries from a specific tier.',
        },
        includeMetadata: {
          type: 'boolean',
          description: 'If true, include metadata (priority, tier, pinned) with each entry. Default: false.',
        },
      },
      required: [],
    },
  },
};

/**
 * Match a key against a glob-like pattern
 * Supports * as wildcard (matches any characters)
 */
function matchPattern(key: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except *
    .replace(/\*/g, '.*'); // Convert * to .*
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(key);
}

/**
 * Create all memory tools
 */
export function createMemoryTools(): ToolFunction[] {
  return [
    // memory_store
    {
      definition: memoryStoreDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError('memory_store', 'Memory tools require TaskAgent context');
        }

        try {
          let key = args.key as string;
          const tier = args.tier as MemoryTier | undefined;
          const derivedFrom = args.derivedFrom as string[] | undefined;

          // If tier is specified, add prefix and use tier priority
          if (tier) {
            key = addTierPrefix(key, tier);
          }

          // Build scope from arguments
          let scope: MemoryScope | undefined;
          if (args.neededForTasks && Array.isArray(args.neededForTasks) && args.neededForTasks.length > 0) {
            scope = { type: 'task', taskIds: args.neededForTasks as string[] };
          } else if (args.scope === 'plan') {
            scope = { type: 'plan' };
          } else if (args.scope === 'persistent') {
            scope = { type: 'persistent' };
          } else if (tier === 'findings') {
            // Findings default to plan scope
            scope = { type: 'plan' };
          } else {
            scope = 'session';
          }

          // Priority: tier priority > explicit priority > default
          let priority: MemoryPriority | undefined = args.priority as MemoryPriority | undefined;
          if (tier) {
            priority = TIER_PRIORITIES[tier];
          }

          await context.memory.set(
            key,
            args.description as string,
            args.value,
            {
              scope,
              priority,
              pinned: args.pinned as boolean | undefined,
            }
          );

          return {
            success: true,
            key,
            tier: tier ?? getTierFromKey(key) ?? 'none',
            scope: typeof scope === 'string' ? scope : scope.type,
            priority: priority ?? 'normal',
            derivedFrom: derivedFrom ?? [],
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
      describeCall: (args) => {
        const tier = args.tier as string | undefined;
        const key = args.key as string;
        return tier ? `${tier}:${key}` : key;
      },
    },

    // memory_retrieve
    {
      definition: memoryRetrieveDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError('memory_retrieve', 'Memory tools require TaskAgent context');
        }

        const value = await context.memory.get(args.key as string);
        if (value === undefined) {
          return { error: `Key "${args.key}" not found in memory` };
        }
        return value;
      },
      idempotency: { safe: true },
      output: { expectedSize: 'variable' },
      describeCall: (args) => args.key as string,
    },

    // memory_delete
    {
      definition: memoryDeleteDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError('memory_delete', 'Memory tools require TaskAgent context');
        }

        await context.memory.delete(args.key as string);
        return { success: true, deleted: args.key };
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
      describeCall: (args) => args.key as string,
    },

    // memory_list
    {
      definition: memoryListDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError('memory_list', 'Memory tools require TaskAgent context');
        }

        let entries = await context.memory.list();

        // Filter by tier if specified
        const tierFilter = args.tier as MemoryTier | undefined;
        if (tierFilter) {
          const prefix = `${tierFilter}.`;
          entries = entries.filter((e) => e.key.startsWith(prefix));
        }

        return {
          entries: entries.map((e) => ({
            key: e.key,
            description: e.description,
            priority: e.effectivePriority,
            tier: getTierFromKey(e.key) ?? 'none',
            pinned: e.pinned,
          })),
          count: entries.length,
          tierFilter: tierFilter ?? 'all',
        };
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
      describeCall: (args) => {
        const tier = args.tier as string | undefined;
        return tier ? `tier:${tier}` : 'all';
      },
    },

    // memory_cleanup_raw
    {
      definition: memoryCleanupRawDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError('memory_cleanup_raw', 'Memory tools require TaskAgent context');
        }

        const keys = args.keys as string[];
        let deletedCount = 0;
        const skipped: string[] = [];

        for (const key of keys) {
          const tier = getTierFromKey(key);
          if (tier === 'raw') {
            const exists = await context.memory.has(key);
            if (exists) {
              await context.memory.delete(key);
              deletedCount++;
            }
          } else {
            skipped.push(key);
          }
        }

        return {
          success: true,
          deleted: deletedCount,
          skipped: skipped.length > 0 ? skipped : undefined,
          skippedReason: skipped.length > 0 ? 'Not raw tier entries' : undefined,
        };
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
      describeCall: (args) => `${(args.keys as string[]).length} keys`,
    },

    // memory_retrieve_batch
    {
      definition: memoryRetrieveBatchDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError('memory_retrieve_batch', 'Memory tools require TaskAgent context');
        }

        const pattern = args.pattern as string | undefined;
        const keys = args.keys as string[] | undefined;
        const tier = args.tier as MemoryTier | undefined;
        const includeMetadata = args.includeMetadata as boolean | undefined;

        // Get all entries to match against
        const allEntries = await context.memory.list();

        // Determine which keys to retrieve
        let keysToRetrieve: string[] = [];

        if (keys && keys.length > 0) {
          // Explicit keys provided
          keysToRetrieve = keys;
        } else if (pattern) {
          // Pattern matching
          keysToRetrieve = allEntries
            .filter((e) => matchPattern(e.key, pattern))
            .map((e) => e.key);
        } else if (tier) {
          // Tier filter
          const prefix = `${tier}.`;
          keysToRetrieve = allEntries
            .filter((e) => e.key.startsWith(prefix))
            .map((e) => e.key);
        } else {
          // No filter - return all
          keysToRetrieve = allEntries.map((e) => e.key);
        }

        // Retrieve all values
        const results: Record<string, unknown> = {};
        const metadata: Record<string, { tier: string; priority: string; pinned: boolean; description: string }> = {};
        const notFound: string[] = [];

        for (const key of keysToRetrieve) {
          const value = await context.memory.get(key);
          if (value !== undefined) {
            results[key] = value;

            if (includeMetadata) {
              const entry = allEntries.find((e) => e.key === key);
              if (entry) {
                metadata[key] = {
                  tier: getTierFromKey(key) ?? 'none',
                  priority: entry.effectivePriority ?? 'normal',
                  pinned: entry.pinned ?? false,
                  description: entry.description,
                };
              }
            }
          } else {
            notFound.push(key);
          }
        }

        return {
          entries: results,
          count: Object.keys(results).length,
          ...(includeMetadata ? { metadata } : {}),
          ...(notFound.length > 0 ? { notFound } : {}),
          filter: pattern ? `pattern:${pattern}` : tier ? `tier:${tier}` : keys ? `keys:${keys.length}` : 'all',
        };
      },
      idempotency: { safe: true },
      output: { expectedSize: 'variable' },
      describeCall: (args) => {
        const pattern = args.pattern as string | undefined;
        const keys = args.keys as string[] | undefined;
        const tier = args.tier as string | undefined;
        if (pattern) return `pattern:${pattern}`;
        if (tier) return `tier:${tier}`;
        if (keys) return `${keys.length} keys`;
        return 'all';
      },
    },
  ];
}
