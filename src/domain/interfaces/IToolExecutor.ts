/**
 * Tool executor interface
 */

import { Tool, ToolFunction } from '../entities/Tool.js';

export interface IToolExecutor {
  /**
   * Execute a tool function
   * @param toolName - Name of the tool to execute
   * @param args - Parsed arguments object
   * @returns Tool execution result
   */
  execute(toolName: string, args: any): Promise<any>;

  /**
   * Check if tool is available
   */
  hasToolFunction(toolName: string): boolean;

  /**
   * Get tool definition
   */
  getToolDefinition(toolName: string): Tool | undefined;

  /**
   * Register a new tool
   */
  registerTool(tool: ToolFunction): void;

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): void;

  /**
   * List all registered tools
   */
  listTools(): string[];
}
