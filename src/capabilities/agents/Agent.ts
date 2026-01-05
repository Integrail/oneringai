/**
 * Agent class - represents an agent with tool calling capabilities
 */

import { ITextProvider } from '../../domain/interfaces/ITextProvider.js';
import { ToolRegistry } from './ToolRegistry.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { InputItem } from '../../domain/entities/Message.js';
import { AgentResponse } from '../../domain/entities/Response.js';
import { AgenticLoop } from './AgenticLoop.js';

export interface AgentConfig {
  provider: string;
  model: string;
  instructions?: string;
  tools?: ToolFunction[];
  temperature?: number;
  maxIterations?: number;
}

export class Agent {
  private agenticLoop: AgenticLoop;

  constructor(
    private config: AgentConfig,
    textProvider: ITextProvider,
    private toolRegistry: ToolRegistry
  ) {
    // Register tools if provided
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolRegistry.registerTool(tool);
      }
    }

    // Create agentic loop
    this.agenticLoop = new AgenticLoop(textProvider, toolRegistry);
  }

  /**
   * Run the agent with input
   */
  async run(input: string | InputItem[]): Promise<AgentResponse> {
    // Get tool definitions for the LLM
    const tools = this.config.tools?.map(t => t.definition) || [];

    return this.agenticLoop.execute({
      model: this.config.model,
      input,
      instructions: this.config.instructions,
      tools,
      temperature: this.config.temperature,
      maxIterations: this.config.maxIterations || 10,
    });
  }

  /**
   * Add a tool to the agent
   */
  addTool(tool: ToolFunction): void {
    this.toolRegistry.registerTool(tool);
    // Add to config tools array
    if (!this.config.tools) {
      this.config.tools = [];
    }
    this.config.tools.push(tool);
  }

  /**
   * Remove a tool from the agent
   */
  removeTool(toolName: string): void {
    this.toolRegistry.unregisterTool(toolName);
    // Remove from config tools array
    if (this.config.tools) {
      this.config.tools = this.config.tools.filter(
        t => t.definition.function.name !== toolName
      );
    }
  }

  /**
   * List registered tools
   */
  listTools(): string[] {
    return this.toolRegistry.listTools();
  }
}
