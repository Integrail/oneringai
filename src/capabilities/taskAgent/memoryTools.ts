/**
 * Memory tools - built-in tools for memory manipulation
 */

import { ToolFunction, FunctionToolDefinition } from '../../domain/entities/Tool.js';
import { ToolContext } from '../../domain/interfaces/IToolContext.js';

/**
 * Tool definition for memory_store
 */
export const memoryStoreDefinition: FunctionToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_store',
    description:
      'Store data in working memory for later use. Use this to save important information from tool outputs.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Namespaced key (e.g., "user.profile", "order.items")',
        },
        description: {
          type: 'string',
          description: 'Brief description of what this data contains (max 150 chars)',
        },
        value: {
          description: 'The data to store (can be any JSON value)',
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
          description: 'The key to retrieve',
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
      properties: {},
      required: [],
    },
  },
};

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
          return { error: 'Memory tools require TaskAgent context' };
        }

        try {
          await context.memory.set(
            args.key as string,
            args.description as string,
            args.value
          );
          return { success: true, key: args.key };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
    },

    // memory_retrieve
    {
      definition: memoryRetrieveDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          return { error: 'Memory tools require TaskAgent context' };
        }

        const value = await context.memory.get(args.key as string);
        if (value === undefined) {
          return { error: `Key "${args.key}" not found in memory` };
        }
        return value;
      },
      idempotency: { safe: true },
      output: { expectedSize: 'variable' },
    },

    // memory_delete
    {
      definition: memoryDeleteDefinition,
      execute: async (args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          return { error: 'Memory tools require TaskAgent context' };
        }

        await context.memory.delete(args.key as string);
        return { success: true, deleted: args.key };
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
    },

    // memory_list
    {
      definition: memoryListDefinition,
      execute: async (_args: Record<string, unknown>, context?: ToolContext) => {
        if (!context || !context.memory) {
          return { error: 'Memory tools require TaskAgent context' };
        }

        return await context.memory.list();
      },
      idempotency: { safe: true },
      output: { expectedSize: 'small' },
    },
  ];
}
