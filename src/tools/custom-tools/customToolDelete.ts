/**
 * custom_tool_delete - Deletes a custom tool from storage
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { ICustomToolStorage } from '../../domain/interfaces/ICustomToolStorage.js';
import { FileCustomToolStorage } from '../../infrastructure/storage/FileCustomToolStorage.js';

interface DeleteArgs {
  name: string;
}

interface DeleteResult {
  success: boolean;
  name: string;
  error?: string;
}

export function createCustomToolDelete(storage: ICustomToolStorage): ToolFunction<DeleteArgs, DeleteResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'custom_tool_delete',
        description: 'Delete a custom tool from persistent storage.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the tool to delete',
            },
          },
          required: ['name'],
        },
      },
    },

    permission: { scope: 'session', riskLevel: 'medium' },

    execute: async (args: DeleteArgs): Promise<DeleteResult> => {
      try {
        const exists = await storage.exists(args.name);
        if (!exists) {
          return { success: false, name: args.name, error: `Custom tool '${args.name}' not found` };
        }

        await storage.delete(args.name);
        return { success: true, name: args.name };
      } catch (error) {
        return { success: false, name: args.name, error: (error as Error).message };
      }
    },

    describeCall: (args: DeleteArgs) => args.name,
  };
}

/** Default custom_tool_delete instance (uses FileCustomToolStorage) */
export const customToolDelete = createCustomToolDelete(new FileCustomToolStorage());
