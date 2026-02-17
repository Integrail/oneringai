/**
 * custom_tool_list - Lists saved custom tools from storage
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { ICustomToolStorage } from '../../domain/interfaces/ICustomToolStorage.js';
import type { CustomToolSummary } from '../../domain/entities/CustomToolDefinition.js';
import { FileCustomToolStorage } from '../../infrastructure/storage/FileCustomToolStorage.js';

interface ListArgs {
  search?: string;
  tags?: string[];
  category?: string;
  limit?: number;
  offset?: number;
}

interface ListResult {
  tools: CustomToolSummary[];
  total: number;
}

export function createCustomToolList(storage: ICustomToolStorage): ToolFunction<ListArgs, ListResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'custom_tool_list',
        description:
          'List saved custom tools from persistent storage. Supports filtering by search text, tags, and category.',
        parameters: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Search text (case-insensitive substring match on name + description)',
            },
            tags: {
              type: 'array',
              description: 'Filter by tags (any match)',
              items: { type: 'string' },
            },
            category: {
              type: 'string',
              description: 'Filter by category',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
            },
            offset: {
              type: 'number',
              description: 'Offset for pagination',
            },
          },
        },
      },
    },

    permission: { scope: 'always', riskLevel: 'low' },

    execute: async (args: ListArgs): Promise<ListResult> => {
      const tools = await storage.list({
        search: args.search,
        tags: args.tags,
        category: args.category,
        limit: args.limit,
        offset: args.offset,
      });

      return { tools, total: tools.length };
    },

    describeCall: (args: ListArgs) => args.search ?? 'all tools',
  };
}

/** Default custom_tool_list instance (uses FileCustomToolStorage) */
export const customToolList = createCustomToolList(new FileCustomToolStorage());
