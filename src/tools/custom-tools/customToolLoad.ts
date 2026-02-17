/**
 * custom_tool_load - Loads a full custom tool definition from storage
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { ICustomToolStorage } from '../../domain/interfaces/ICustomToolStorage.js';
import type { CustomToolDefinition } from '../../domain/entities/CustomToolDefinition.js';
import { FileCustomToolStorage } from '../../infrastructure/storage/FileCustomToolStorage.js';

interface LoadArgs {
  name: string;
}

interface LoadResult {
  success: boolean;
  tool?: CustomToolDefinition;
  error?: string;
}

export function createCustomToolLoad(storage: ICustomToolStorage): ToolFunction<LoadArgs, LoadResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'custom_tool_load',
        description:
          'Load a full custom tool definition from storage (including code). ' +
          'Use this to inspect, modify, or hydrate a saved tool.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the tool to load',
            },
          },
          required: ['name'],
        },
      },
    },

    permission: { scope: 'always', riskLevel: 'low' },

    execute: async (args: LoadArgs): Promise<LoadResult> => {
      const tool = await storage.load(args.name);
      if (!tool) {
        return { success: false, error: `Custom tool '${args.name}' not found` };
      }
      return { success: true, tool };
    },

    describeCall: (args: LoadArgs) => args.name,
  };
}

/** Default custom_tool_load instance (uses FileCustomToolStorage) */
export const customToolLoad = createCustomToolLoad(new FileCustomToolStorage());
