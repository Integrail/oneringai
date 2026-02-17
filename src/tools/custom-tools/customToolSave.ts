/**
 * custom_tool_save - Persists a custom tool definition to storage
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { ICustomToolStorage } from '../../domain/interfaces/ICustomToolStorage.js';
import type { CustomToolDefinition } from '../../domain/entities/CustomToolDefinition.js';
import { CUSTOM_TOOL_DEFINITION_VERSION } from '../../domain/entities/CustomToolDefinition.js';

interface SaveArgs {
  name: string;
  description: string;
  displayName?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  code: string;
  tags?: string[];
  category?: string;
  generationPrompt?: string;
  connectorNames?: string[];
}

interface SaveResult {
  success: boolean;
  name: string;
  storagePath: string;
  error?: string;
}

export function createCustomToolSave(storage: ICustomToolStorage): ToolFunction<SaveArgs, SaveResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'custom_tool_save',
        description:
          'Save a custom tool definition to persistent storage. ' +
          'The tool can later be loaded, hydrated, and registered on any agent.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Tool name (must match /^[a-z][a-z0-9_]*$/)',
            },
            description: {
              type: 'string',
              description: 'What the tool does',
            },
            displayName: {
              type: 'string',
              description: 'Optional human-readable display name',
            },
            inputSchema: {
              type: 'object',
              description: 'JSON Schema for input parameters',
            },
            outputSchema: {
              type: 'object',
              description: 'Optional JSON Schema for output',
            },
            code: {
              type: 'string',
              description: 'JavaScript code (same sandbox as execute_javascript)',
            },
            tags: {
              type: 'array',
              description: 'Tags for categorization',
              items: { type: 'string' },
            },
            category: {
              type: 'string',
              description: 'Category grouping',
            },
            generationPrompt: {
              type: 'string',
              description: 'The prompt that was used to generate this tool (for reference)',
            },
            connectorNames: {
              type: 'array',
              description: 'Connector names this tool uses',
              items: { type: 'string' },
            },
          },
          required: ['name', 'description', 'inputSchema', 'code'],
        },
      },
    },

    permission: { scope: 'session', riskLevel: 'medium' },

    execute: async (args: SaveArgs): Promise<SaveResult> => {
      try {
        const now = new Date().toISOString();

        // Preserve createdAt if updating an existing tool
        const existing = await storage.load(args.name);

        const definition: CustomToolDefinition = {
          version: CUSTOM_TOOL_DEFINITION_VERSION,
          name: args.name,
          displayName: args.displayName,
          description: args.description,
          inputSchema: args.inputSchema,
          outputSchema: args.outputSchema,
          code: args.code,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          metadata: {
            tags: args.tags,
            category: args.category,
            generationPrompt: args.generationPrompt,
            connectorNames: args.connectorNames,
            requiresConnector: (args.connectorNames?.length ?? 0) > 0,
          },
        };

        await storage.save(definition);

        return {
          success: true,
          name: args.name,
          storagePath: storage.getPath(),
        };
      } catch (error) {
        return {
          success: false,
          name: args.name,
          storagePath: storage.getPath(),
          error: (error as Error).message,
        };
      }
    },

    describeCall: (args: SaveArgs) => args.name,
  };
}
