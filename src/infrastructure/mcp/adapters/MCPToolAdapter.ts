/**
 * MCP Tool Adapter
 *
 * Converts MCP tools to ToolFunction interface for use with ToolManager.
 */

import type { ToolFunction } from '../../../domain/entities/Tool.js';
import type { MCPTool, MCPToolResult } from '../../../domain/entities/MCPTypes.js';
import type { IMCPClient } from '../../../domain/interfaces/IMCPClient.js';
import { MCPToolError } from '../../../domain/errors/MCPError.js';

/**
 * Convert an MCP tool to a ToolFunction
 */
export function createMCPToolAdapter(
  tool: MCPTool,
  client: IMCPClient,
  namespace: string
): ToolFunction {
  const fullName = `${namespace}:${tool.name}`;

  return {
    definition: {
      type: 'function',
      function: {
        name: fullName,
        description: tool.description || `MCP tool '${tool.name}' from server '${client.name}'`,
        parameters: tool.inputSchema,
      },
    },

    async execute(args: Record<string, unknown>): Promise<MCPToolResult | string> {
      try {
        const result = await client.callTool(tool.name, args);

        // If the result is a simple text response, return just the text
        if (result.content.length === 1 && result.content[0].type === 'text') {
          return result.content[0].text || '';
        }

        // Otherwise return the full result for complex responses
        return result;
      } catch (error) {
        if (error instanceof MCPToolError) {
          throw error;
        }
        throw new MCPToolError(
          `Failed to execute MCP tool '${tool.name}'`,
          tool.name,
          client.name,
          error as Error
        );
      }
    },

    describeCall(args: Record<string, unknown>): string {
      // Try common argument names for human-readable description
      const commonKeys = [
        'file_path',
        'path',
        'uri',
        'url',
        'query',
        'message',
        'name',
        'id',
        'key',
      ];

      for (const key of commonKeys) {
        if (key in args && typeof args[key] === 'string') {
          return args[key] as string;
        }
      }

      // Fallback to first string value
      for (const value of Object.values(args)) {
        if (typeof value === 'string' && value.length > 0) {
          return value.length > 60 ? `${value.substring(0, 60)}...` : value;
        }
      }

      // Final fallback
      return tool.name;
    },
  };
}

/**
 * Convert all tools from an MCP client to ToolFunctions
 */
export function createMCPToolAdapters(
  tools: MCPTool[],
  client: IMCPClient,
  namespace: string
): ToolFunction[] {
  return tools.map((tool) => createMCPToolAdapter(tool, client, namespace));
}
