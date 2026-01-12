/**
 * Tool registry - manages tool registration and execution
 */

import { IToolExecutor } from '../../domain/interfaces/IToolExecutor.js';
import { Tool, ToolFunction } from '../../domain/entities/Tool.js';
import { ToolNotFoundError, ToolExecutionError } from '../../domain/errors/AIErrors.js';

export class ToolRegistry implements IToolExecutor {
  private tools: Map<string, ToolFunction> = new Map();

  /**
   * Register a new tool
   */
  registerTool(tool: ToolFunction): void {
    this.tools.set(tool.definition.function.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  /**
   * Execute a tool function
   */
  async execute(toolName: string, args: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    try {
      return await tool.execute(args);
    } catch (error) {
      throw new ToolExecutionError(
        toolName,
        (error as Error).message,
        error as Error
      );
    }
  }

  /**
   * Check if tool is available
   */
  hasToolFunction(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get tool definition
   */
  getToolDefinition(toolName: string): Tool | undefined {
    const tool = this.tools.get(toolName);
    return tool?.definition;
  }

  /**
   * List all registered tools
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }
}
