/**
 * Agentic loop - handles tool calling and multi-turn conversations
 * Simplified version for MVP - only blocking tools
 */

import { ITextProvider, TextGenerateOptions } from '../../domain/interfaces/ITextProvider.js';
import { IToolExecutor } from '../../domain/interfaces/IToolExecutor.js';
import { AgentResponse } from '../../domain/entities/Response.js';
import { InputItem, MessageRole, OutputItem } from '../../domain/entities/Message.js';
import { Tool, ToolCall, ToolCallState, ToolResult } from '../../domain/entities/Tool.js';
import { ContentType, ToolResultContent } from '../../domain/entities/Content.js';
import { ToolTimeoutError } from '../../domain/errors/AIErrors.js';

export interface AgenticLoopConfig {
  model: string;
  input: string | InputItem[];
  instructions?: string;
  tools: Tool[];
  temperature?: number;
  maxIterations: number;
}

export class AgenticLoop {
  constructor(
    private provider: ITextProvider,
    private toolExecutor: IToolExecutor
  ) {}

  /**
   * Execute agentic loop with tool calling
   */
  async execute(config: AgenticLoopConfig): Promise<AgentResponse> {
    let currentInput = config.input;
    let iteration = 0;

    while (iteration < config.maxIterations) {
      // Generate response
      const generateOptions: TextGenerateOptions = {
        model: config.model,
        input: currentInput,
        instructions: config.instructions,
        tools: config.tools,
        tool_choice: 'auto',
        temperature: config.temperature,
      };

      const response = await this.provider.generate(generateOptions);

      // Extract tool calls
      const toolCalls = this.extractToolCalls(response.output, config.tools);

      // If no tool calls, we're done
      if (toolCalls.length === 0) {
        return response;
      }

      // Execute tools (blocking only for MVP)
      const toolResults = await this.executeTools(toolCalls);

      // Build next input with tool results
      currentInput = this.buildInputWithToolResults(response.output, toolResults);

      iteration++;
    }

    // Max iterations reached
    throw new Error(`Max iterations (${config.maxIterations}) reached without completion`);
  }

  /**
   * Extract tool calls from response output
   */
  private extractToolCalls(output: OutputItem[], toolDefinitions: Tool[]): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Create tool map for quick lookup
    const toolMap = new Map<string, Tool>();
    for (const tool of toolDefinitions) {
      if (tool.type === 'function') {
        toolMap.set(tool.function.name, tool);
      }
    }

    // Extract tool calls from output
    for (const item of output) {
      if (item.type === 'message' && item.role === MessageRole.ASSISTANT) {
        for (const content of item.content) {
          if (content.type === ContentType.TOOL_USE) {
            const toolDef = toolMap.get(content.name);
            const isBlocking = toolDef?.blocking !== false; // Default: true

            const toolCall: ToolCall = {
              id: content.id,
              type: 'function',
              function: {
                name: content.name,
                arguments: content.arguments,
              },
              blocking: isBlocking,
              state: ToolCallState.PENDING,
            };

            toolCalls.push(toolCall);
          }
        }
      }
    }

    return toolCalls;
  }

  /**
   * Execute tools (blocking only for MVP)
   */
  private async executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      toolCall.state = ToolCallState.EXECUTING;
      toolCall.startTime = new Date();

      try {
        // Execute with timeout (default 30s)
        const timeout = 30000;
        const result = await this.executeWithTimeout(
          () => this.toolExecutor.execute(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          ),
          timeout
        );

        toolCall.state = ToolCallState.COMPLETED;
        toolCall.endTime = new Date();

        const toolResult: ToolResult = {
          tool_use_id: toolCall.id,
          content: result,
          state: ToolCallState.COMPLETED,
          executionTime: toolCall.endTime.getTime() - toolCall.startTime.getTime(),
        };

        results.push(toolResult);
      } catch (error) {
        toolCall.state = ToolCallState.FAILED;
        toolCall.endTime = new Date();
        toolCall.error = (error as Error).message;

        const toolResult: ToolResult = {
          tool_use_id: toolCall.id,
          content: '',
          error: (error as Error).message,
          state: ToolCallState.FAILED,
        };

        results.push(toolResult);
      }
    }

    return results;
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError('tool', timeoutMs));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Build input with tool results
   */
  private buildInputWithToolResults(
    previousOutput: OutputItem[],
    toolResults: ToolResult[]
  ): InputItem[] {
    const input: InputItem[] = [];

    // Add assistant's previous response as input
    for (const item of previousOutput) {
      if (item.type === 'message') {
        input.push(item);
      }
    }

    // Add tool results as user message
    const toolResultContents: ToolResultContent[] = toolResults.map(result => ({
      type: ContentType.TOOL_RESULT,
      tool_use_id: result.tool_use_id,
      content: result.content,
      error: result.error,
    }));

    if (toolResultContents.length > 0) {
      input.push({
        type: 'message',
        role: MessageRole.USER,
        content: toolResultContents,
      });
    }

    return input;
  }
}
