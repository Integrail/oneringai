/**
 * Agentic loop - handles tool calling and multi-turn conversations
 * Now with events, hooks, pause/resume, and enterprise features
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'eventemitter3';
import { ITextProvider, TextGenerateOptions } from '../../domain/interfaces/ITextProvider.js';
import { IToolExecutor } from '../../domain/interfaces/IToolExecutor.js';
import { AgentResponse } from '../../domain/entities/Response.js';
import { InputItem, MessageRole, OutputItem } from '../../domain/entities/Message.js';
import { Tool, ToolCall, ToolCallState, ToolResult } from '../../domain/entities/Tool.js';
import { ContentType, ToolResultContent } from '../../domain/entities/Content.js';
import { ToolTimeoutError } from '../../domain/errors/AIErrors.js';
import { ExecutionContext, HistoryMode } from './ExecutionContext.js';
import { HookManager } from './HookManager.js';
import { HookConfig } from './types/HookTypes.js';
import { AgenticLoopEvents } from './types/EventTypes.js';
import { StreamEvent, StreamEventType, isToolCallArgumentsDone } from '../../domain/entities/StreamEvent.js';
import { StreamState } from '../../domain/entities/StreamState.js';

export interface AgenticLoopConfig {
  model: string;
  input: string | InputItem[];
  instructions?: string;
  tools: Tool[];
  temperature?: number;
  maxIterations: number;

  // NEW: Enterprise configuration
  hooks?: HookConfig;
  historyMode?: HistoryMode;
  limits?: {
    maxExecutionTime?: number;
    maxToolCalls?: number;
    maxContextSize?: number;
    /** Maximum input messages to keep (prevents unbounded growth). Default: 50 */
    maxInputMessages?: number;
  };
  errorHandling?: {
    hookFailureMode?: 'fail' | 'warn' | 'ignore';
    toolFailureMode?: 'fail' | 'warn' | 'continue';
    maxConsecutiveErrors?: number;
  };
}

export class AgenticLoop extends EventEmitter<AgenticLoopEvents> {
  private hookManager: HookManager;
  private context: ExecutionContext | null = null;

  // Pause/resume state
  private paused: boolean = false;
  private pausePromise: Promise<void> | null = null;
  private resumeCallback: (() => void) | null = null;
  private cancelled: boolean = false;
  // Mutex to prevent race conditions in pause/resume
  private pauseResumeMutex: Promise<void> = Promise.resolve();

  constructor(
    private provider: ITextProvider,
    private toolExecutor: IToolExecutor,
    hookConfig?: HookConfig,
    errorHandling?: { maxConsecutiveErrors?: number }
  ) {
    super();
    this.hookManager = new HookManager(
      hookConfig || {},
      this,
      errorHandling
    );
  }

  /**
   * Execute agentic loop with tool calling
   */
  async execute(config: AgenticLoopConfig): Promise<AgentResponse> {
    // Generate execution ID
    const executionId = `exec_${randomUUID()}`;

    // Create execution context
    this.context = new ExecutionContext(executionId, {
      maxHistorySize: 10,
      historyMode: config.historyMode || 'summary',
      maxAuditTrailSize: 1000,
    });

    // Reset state
    this.paused = false;
    this.cancelled = false;

    // Emit execution start
    this.emit('execution:start', {
      executionId,
      config,
      timestamp: new Date(),
    });

    // Execute before:execution hook
    await this.hookManager.executeHooks('before:execution', {
      executionId,
      config,
      timestamp: new Date(),
    }, undefined as any);

    let currentInput = config.input;
    let iteration = 0;
    let finalResponse: AgentResponse;

    try {
      while (iteration < config.maxIterations) {
        // Check pause
        await this.checkPause();

        // Check if cancelled
        if (this.cancelled) {
          throw new Error('Execution cancelled');
        }

        // Check resource limits
        this.context.checkLimits(config.limits);

        // Check pause hook
        const pauseCheck = await this.hookManager.executeHooks('pause:check', {
          executionId,
          iteration,
          context: this.context,
          timestamp: new Date(),
        }, { shouldPause: false });

        if (pauseCheck.shouldPause) {
          this.pause(pauseCheck.reason || 'Hook requested pause');
          await this.checkPause();
        }

        // Update iteration
        this.context.iteration = iteration;

        // Emit iteration start
        this.emit('iteration:start', {
          executionId,
          iteration,
          timestamp: new Date(),
        });

        const iterationStartTime = Date.now();

        // Generate LLM response
        const response = await this.generateWithHooks(config, currentInput, iteration, executionId);

        // Extract tool calls
        const toolCalls = this.extractToolCalls(response.output, config.tools);

        // Emit tool detection
        if (toolCalls.length > 0) {
          this.emit('tool:detected', {
            executionId,
            iteration,
            toolCalls,
            timestamp: new Date(),
          });
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          // Emit iteration complete
          this.emit('iteration:complete', {
            executionId,
            iteration,
            response,
            timestamp: new Date(),
            duration: Date.now() - iterationStartTime,
          });

          finalResponse = response;
          break;
        }

        // Execute tools with hooks
        const toolResults = await this.executeToolsWithHooks(toolCalls, iteration, executionId);

        // Store iteration record
        this.context.addIteration({
          iteration,
          request: {
            model: config.model,
            input: currentInput,
            instructions: config.instructions,
            tools: config.tools,
            temperature: config.temperature,
          },
          response,
          toolCalls,
          toolResults,
          startTime: new Date(iterationStartTime),
          endTime: new Date(),
        });

        // Update metrics
        this.context.updateMetrics({
          iterationCount: iteration + 1,
          inputTokens: this.context.metrics.inputTokens + (response.usage?.input_tokens || 0),
          outputTokens: this.context.metrics.outputTokens + (response.usage?.output_tokens || 0),
          totalTokens: this.context.metrics.totalTokens + (response.usage?.total_tokens || 0),
        });

        // Emit iteration complete
        this.emit('iteration:complete', {
          executionId,
          iteration,
          response,
          timestamp: new Date(),
          duration: Date.now() - iterationStartTime,
        });

        // Build next input
        currentInput = this.buildInputWithToolResults(response.output, toolResults);

        iteration++;
      }

      // Check if we exited normally or hit max iterations
      if (iteration >= config.maxIterations) {
        throw new Error(`Max iterations (${config.maxIterations}) reached without completion`);
      }

      // Calculate total duration
      const totalDuration = Date.now() - this.context.startTime.getTime();
      this.context.updateMetrics({ totalDuration });

      // Execute after:execution hook
      await this.hookManager.executeHooks('after:execution', {
        executionId,
        response: finalResponse!,
        context: this.context,
        timestamp: new Date(),
        duration: totalDuration,
      }, undefined as any);

      // Emit execution complete
      this.emit('execution:complete', {
        executionId,
        response: finalResponse!,
        timestamp: new Date(),
        duration: totalDuration,
      });

      return finalResponse!;
    } catch (error) {
      // Emit execution error
      this.emit('execution:error', {
        executionId,
        error: error as Error,
        timestamp: new Date(),
      });

      // Record error in metrics
      this.context?.metrics.errors.push({
        type: 'execution_error',
        message: (error as Error).message,
        timestamp: new Date(),
      });

      throw error;
    } finally {
      // Always cleanup resources
      this.context?.cleanup();
      this.hookManager.clear();
    }
  }

  /**
   * Execute agentic loop with streaming and tool calling
   */
  async *executeStreaming(config: AgenticLoopConfig): AsyncIterableIterator<StreamEvent> {
    // Generate execution ID
    const executionId = `exec_${randomUUID()}`;

    // Create execution context
    this.context = new ExecutionContext(executionId, {
      maxHistorySize: 10,
      historyMode: config.historyMode || 'summary',
      maxAuditTrailSize: 1000,
    });

    // Reset state
    this.paused = false;
    this.cancelled = false;
    this.pausePromise = null;
    this.resumeCallback = null;

    const startTime = Date.now();
    let iteration = 0;
    let currentInput: string | InputItem[] = config.input;

    // Create a single StreamState for the entire execution (tracks usage across iterations)
    const globalStreamState = new StreamState(executionId, config.model);

    try {
      // Emit execution start event
      this.emit('execution:start', {
        executionId,
        model: config.model,
        timestamp: new Date(),
      });

      // Execute before:execution hook
      await this.hookManager.executeHooks('before:execution', {
        executionId,
        config,
        timestamp: new Date(),
      }, undefined as any);

      // Main agentic loop
      while (iteration < config.maxIterations) {
        iteration++;

        // Check pause state
        await this.checkPause();

        // Check if cancelled
        if (this.cancelled) {
          this.emit('execution:cancelled', { executionId, iteration, timestamp: new Date() });
          break;
        }

        // Check resource limits
        if (this.context) {
          this.context.checkLimits(config.limits);
        }

        // Execute pause:check hook (allows dynamic pause decisions)
        const pauseCheck = await this.hookManager.executeHooks('pause:check', {
          executionId,
          iteration,
          context: this.context!,
          timestamp: new Date(),
        }, { shouldPause: false });

        if (pauseCheck.shouldPause) {
          this.pause();
        }

        // Emit iteration start
        this.emit('iteration:start', {
          executionId,
          iteration,
          timestamp: new Date(),
        });

        // Stream LLM response and accumulate state (per-iteration state)
        const iterationStreamState = new StreamState(executionId, config.model);
        const toolCallsMap = new Map<string, { name: string; args: string }>();

        // Stream from provider with hooks
        yield* this.streamGenerateWithHooks(config, currentInput, iteration, executionId, iterationStreamState, toolCallsMap);

        // Accumulate usage from this iteration into global state
        globalStreamState.accumulateUsage(iterationStreamState.usage);

        // Check if any tool calls were detected
        const toolCalls: ToolCall[] = [];
        for (const [toolCallId, buffer] of toolCallsMap) {
          toolCalls.push({
            id: toolCallId,
            type: 'function',
            function: {
              name: buffer.name,
              arguments: buffer.args,
            },
            blocking: true,
            state: ToolCallState.PENDING,
          });
        }

        // No tool calls? We're done
        if (toolCalls.length === 0) {
          // Yield iteration complete
          yield {
            type: StreamEventType.ITERATION_COMPLETE,
            response_id: executionId,
            iteration,
            tool_calls_count: 0,
            has_more_iterations: false,
          };

          // Final response complete with accumulated usage from all iterations
          yield {
            type: StreamEventType.RESPONSE_COMPLETE,
            response_id: executionId,
            status: 'completed',
            usage: globalStreamState.usage,
            iterations: iteration,
            duration_ms: Date.now() - startTime,
          };

          break;
        }

        // Execute tools and yield execution events
        const toolResults: ToolResult[] = [];

        for (const toolCall of toolCalls) {
          // Parse and validate arguments
          let parsedArgs: any;
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            // Invalid JSON - skip this tool
            yield {
              type: StreamEventType.TOOL_EXECUTION_DONE,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: null,
              execution_time_ms: 0,
              error: `Invalid tool arguments JSON: ${(error as Error).message}`,
            };
            continue;
          }

          // Emit tool execution start
          yield {
            type: StreamEventType.TOOL_EXECUTION_START,
            response_id: executionId,
            tool_call_id: toolCall.id,
            tool_name: toolCall.function.name,
            arguments: parsedArgs,
          };

          const toolStartTime = Date.now();

          try {
            // Execute tool with hooks
            const result = await this.executeToolWithHooks(toolCall, iteration, executionId);
            toolResults.push(result);

            // Emit tool execution done
            yield {
              type: StreamEventType.TOOL_EXECUTION_DONE,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: result.content,
              execution_time_ms: Date.now() - toolStartTime,
            };
          } catch (error) {
            // Emit tool execution error
            yield {
              type: StreamEventType.TOOL_EXECUTION_DONE,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: null,
              execution_time_ms: Date.now() - toolStartTime,
              error: (error as Error).message,
            };

            throw error; // Re-throw to stop execution
          }
        }

        // Build next input with tool results
        const assistantMessage: InputItem = {
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: [
            {
              type: ContentType.OUTPUT_TEXT,
              text: iterationStreamState.getAllText(),
            },
            ...toolCalls.map((tc) => ({
              type: ContentType.TOOL_USE as const,
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            })),
          ],
        };

        const toolResultsMessage: InputItem = {
          type: 'message',
          role: MessageRole.USER,
          content: toolResults.map((tr) => ({
            type: ContentType.TOOL_RESULT as const,
            tool_use_id: tr.tool_use_id,
            content: tr.content,
            error: tr.error,
          })),
        };

        // Update current input for next iteration
        if (Array.isArray(currentInput)) {
          currentInput = [...currentInput, assistantMessage, toolResultsMessage];
        } else {
          currentInput = [
            {
              type: 'message' as const,
              role: MessageRole.USER,
              content: [{ type: ContentType.INPUT_TEXT, text: currentInput }],
            },
            assistantMessage,
            toolResultsMessage,
          ];
        }

        // Apply sliding window to prevent unbounded input growth
        const maxInputMessages = config.limits?.maxInputMessages ?? 50;
        if (Array.isArray(currentInput) && currentInput.length > maxInputMessages) {
          // Keep the first message (usually system/developer message) and last N-1 messages
          const firstMessage = currentInput[0];
          const recentMessages = currentInput.slice(-(maxInputMessages - 1));

          // Check if first message is a developer/system message
          const isSystemMessage = firstMessage?.type === 'message' &&
            firstMessage.role === MessageRole.DEVELOPER;

          if (isSystemMessage) {
            currentInput = [firstMessage, ...recentMessages];
          } else {
            // No system message, just keep the most recent messages
            currentInput = currentInput.slice(-maxInputMessages);
          }
        }

        // Yield iteration complete
        yield {
          type: StreamEventType.ITERATION_COMPLETE,
          response_id: executionId,
          iteration,
          tool_calls_count: toolCalls.length,
          has_more_iterations: true,
        };

        // Store iteration in context
        if (this.context) {
          globalStreamState.incrementIteration();
        }

        // Clear per-iteration resources to prevent memory accumulation
        iterationStreamState.clear();
        toolCallsMap.clear();
      }

      // If loop ended due to max iterations (not early break), emit final completion
      if (iteration >= config.maxIterations) {
        yield {
          type: StreamEventType.RESPONSE_COMPLETE,
          response_id: executionId,
          status: 'incomplete', // Incomplete because we hit max iterations
          usage: globalStreamState.usage,
          iterations: iteration,
          duration_ms: Date.now() - startTime,
        };
      }

      // Execute after:execution hook
      await this.hookManager.executeHooks('after:execution', {
        executionId,
        response: null as any, // We don't have a complete response in streaming
        context: this.context,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      }, undefined as any);

      // Emit execution complete
      this.emit('execution:complete', {
        executionId,
        iterations: iteration,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      });
    } catch (error) {
      // Emit execution error
      this.emit('execution:error', {
        executionId,
        error: error as Error,
        timestamp: new Date(),
      });

      // Yield error event
      yield {
        type: StreamEventType.ERROR,
        response_id: executionId,
        error: {
          type: 'execution_error',
          message: (error as Error).message,
        },
        recoverable: false,
      };

      throw error;
    } finally {
      // Always cleanup resources
      globalStreamState.clear();
      this.context?.cleanup();
      this.hookManager.clear();
    }
  }

  /**
   * Stream LLM response with hooks
   * @private
   */
  private async *streamGenerateWithHooks(
    config: AgenticLoopConfig,
    input: string | InputItem[],
    iteration: number,
    executionId: string,
    streamState: StreamState,
    toolCallsMap: Map<string, { name: string; args: string }>
  ): AsyncIterableIterator<StreamEvent> {
    const llmStartTime = Date.now();

    // Prepare options
    let generateOptions: TextGenerateOptions = {
      model: config.model,
      input,
      instructions: config.instructions,
      tools: config.tools,
      tool_choice: 'auto',
      temperature: config.temperature,
    };

    // Execute before:llm hook
    await this.hookManager.executeHooks('before:llm', {
      executionId,
      iteration,
      options: generateOptions,
      context: this.context!,
      timestamp: new Date(),
    }, {});

    // Emit LLM request event
    this.emit('llm:request', {
      executionId,
      iteration,
      model: config.model,
      timestamp: new Date(),
    });

    try {
      // Stream from provider
      for await (const event of this.provider.streamGenerate(generateOptions)) {
        // Update stream state based on event
        if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
          streamState.accumulateTextDelta(event.item_id, event.delta);
        } else if (event.type === StreamEventType.TOOL_CALL_START) {
          streamState.startToolCall(event.tool_call_id, event.tool_name);
          toolCallsMap.set(event.tool_call_id, { name: event.tool_name, args: '' });
        } else if (event.type === StreamEventType.TOOL_CALL_ARGUMENTS_DELTA) {
          streamState.accumulateToolArguments(event.tool_call_id, event.delta);
          const buffer = toolCallsMap.get(event.tool_call_id);
          if (buffer) {
            buffer.args += event.delta;
          }
        } else if (isToolCallArgumentsDone(event)) {
          streamState.completeToolCall(event.tool_call_id);
          const buffer = toolCallsMap.get(event.tool_call_id);
          if (buffer) {
            buffer.args = event.arguments;
          }
        } else if (event.type === StreamEventType.RESPONSE_COMPLETE) {
          streamState.updateUsage(event.usage);

          if (process.env.DEBUG_STREAMING) {
            console.error('[DEBUG] Captured usage from provider:', event.usage);
            console.error('[DEBUG] StreamState usage after update:', streamState.usage);
          }

          // Don't yield provider's RESPONSE_COMPLETE - we'll emit our own at the end
          continue;
        }

        // Yield event to caller (except RESPONSE_COMPLETE which we handle ourselves)
        yield event;
      }

      // Update metrics
      if (this.context) {
        this.context.metrics.llmDuration += Date.now() - llmStartTime;
        this.context.metrics.inputTokens += streamState.usage.input_tokens;
        this.context.metrics.outputTokens += streamState.usage.output_tokens;
        this.context.metrics.totalTokens += streamState.usage.total_tokens;
      }

      if (process.env.DEBUG_STREAMING) {
        console.error('[DEBUG] Stream iteration complete, usage:', streamState.usage);
      }

      // Execute after:llm hook
      await this.hookManager.executeHooks('after:llm', {
        executionId,
        iteration,
        response: null as any, // Streaming doesn't have complete response yet
        context: this.context!,
        timestamp: new Date(),
        duration: Date.now() - llmStartTime,
      }, {});

      // Emit LLM response event
      this.emit('llm:response', {
        executionId,
        iteration,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emit('llm:error', {
        executionId,
        iteration,
        error: error as Error,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Execute single tool with hooks
   * @private
   */
  private async executeToolWithHooks(
    toolCall: ToolCall,
    iteration: number,
    executionId: string
  ): Promise<ToolResult> {
    const toolStartTime = Date.now();

    toolCall.state = ToolCallState.EXECUTING;
    toolCall.startTime = new Date();

    // Execute before:tool hook
    await this.hookManager.executeHooks('before:tool', {
      executionId,
      iteration,
      toolCall,
      context: this.context!,
      timestamp: new Date(),
    }, {});

    // Execute approve:tool hook if registered
    if (this.hookManager.hasHooks('approve:tool')) {
      const approval = await this.hookManager.executeHooks('approve:tool', {
        executionId,
        iteration,
        toolCall,
        context: this.context!,
        timestamp: new Date(),
      }, { approved: true });

      if (!approval.approved) {
        throw new Error(`Tool execution rejected: ${approval.reason || 'No reason provided'}`);
      }
    }

    // Emit tool start
    this.emit('tool:start', {
      executionId,
      iteration,
      toolCall,
      timestamp: new Date(),
    });

    try {
      // Execute tool with timeout
      const args = JSON.parse(toolCall.function.arguments);
      const result = await this.executeWithTimeout(
        () => this.toolExecutor.execute(toolCall.function.name, args),
        30000 // 30 seconds timeout
      );

      // Create tool result
      const toolResult: ToolResult = {
        tool_use_id: toolCall.id,
        content: result,
        executionTime: Date.now() - toolStartTime,
        state: ToolCallState.COMPLETED,
      };

      toolCall.state = ToolCallState.COMPLETED;
      toolCall.endTime = new Date();

      // Execute after:tool hook
      await this.hookManager.executeHooks('after:tool', {
        executionId,
        iteration,
        toolCall,
        result: toolResult,
        context: this.context!,
        timestamp: new Date(),
      }, {});

      // Update metrics
      if (this.context) {
        this.context.metrics.toolCallCount++;
        this.context.metrics.toolSuccessCount++;
        this.context.metrics.toolDuration += toolResult.executionTime || 0;
      }

      // Emit tool complete
      this.emit('tool:complete', {
        executionId,
        iteration,
        toolCall,
        result: toolResult,
        timestamp: new Date(),
      });

      return toolResult;
    } catch (error) {
      toolCall.state = ToolCallState.FAILED;
      toolCall.endTime = new Date();
      toolCall.error = (error as Error).message;

      // Update metrics
      if (this.context) {
        this.context.metrics.toolFailureCount++;
      }

      // Emit tool error
      this.emit('tool:error', {
        executionId,
        iteration,
        toolCall,
        error: error as Error,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Generate LLM response with hooks
   */
  private async generateWithHooks(
    config: AgenticLoopConfig,
    input: string | InputItem[],
    iteration: number,
    executionId: string
  ): Promise<AgentResponse> {
    const llmStartTime = Date.now();

    // Prepare options
    let generateOptions: TextGenerateOptions = {
      model: config.model,
      input,
      instructions: config.instructions,
      tools: config.tools,
      tool_choice: 'auto',
      temperature: config.temperature,
    };

    // Execute before:llm hook
    const beforeLLM = await this.hookManager.executeHooks('before:llm', {
      executionId,
      iteration,
      options: generateOptions,
      context: this.context!,
      timestamp: new Date(),
    }, {});

    // Apply modifications
    if (beforeLLM.modified) {
      generateOptions = { ...generateOptions, ...beforeLLM.modified };
    }

    // Skip if requested
    if (beforeLLM.skip) {
      throw new Error('LLM call skipped by hook');
    }

    // Emit LLM request
    this.emit('llm:request', {
      executionId,
      iteration,
      options: generateOptions,
      timestamp: new Date(),
    });

    try {
      // Call provider
      const response = await this.provider.generate(generateOptions);

      const llmDuration = Date.now() - llmStartTime;

      // Update metrics
      this.context?.updateMetrics({
        llmDuration: (this.context.metrics.llmDuration || 0) + llmDuration,
      });

      // Emit LLM response
      this.emit('llm:response', {
        executionId,
        iteration,
        response,
        timestamp: new Date(),
        duration: llmDuration,
      });

      // Execute after:llm hook
      await this.hookManager.executeHooks('after:llm', {
        executionId,
        iteration,
        response,
        context: this.context!,
        timestamp: new Date(),
        duration: llmDuration,
      }, {});

      return response;
    } catch (error) {
      // Emit LLM error
      this.emit('llm:error', {
        executionId,
        iteration,
        error: error as Error,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Execute tools with hooks
   */
  private async executeToolsWithHooks(
    toolCalls: ToolCall[],
    iteration: number,
    executionId: string
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      // Add to context
      this.context?.addToolCall(toolCall);

      // Check pause before each tool
      await this.checkPause();

      // Execute before:tool hook
      const beforeTool = await this.hookManager.executeHooks('before:tool', {
        executionId,
        iteration,
        toolCall,
        context: this.context!,
        timestamp: new Date(),
      }, {});

      // Check if tool should be skipped
      if (beforeTool.skip) {
        this.context?.audit('tool_skipped', { toolCall }, undefined, toolCall.function.name);

        const mockResult: ToolResult = {
          tool_use_id: toolCall.id,
          content: beforeTool.mockResult || '',
          state: ToolCallState.COMPLETED,
          executionTime: 0,
        };

        results.push(mockResult);
        this.context?.addToolResult(mockResult);
        continue;
      }

      // Apply modifications if any
      if (beforeTool.modified) {
        Object.assign(toolCall, beforeTool.modified);
        this.context?.audit('tool_modified', { modifications: beforeTool.modified }, undefined, toolCall.function.name);
      }

      // Execute approve:tool hook (if exists)
      if (this.hookManager.hasHooks('approve:tool')) {
        const approval = await this.hookManager.executeHooks('approve:tool', {
          executionId,
          iteration,
          toolCall,
          context: this.context!,
          timestamp: new Date(),
        }, { approved: true });

        if (!approval.approved) {
          this.context?.audit('tool_rejected', { reason: approval.reason }, undefined, toolCall.function.name);

          const rejectedResult: ToolResult = {
            tool_use_id: toolCall.id,
            content: '',
            error: `Tool rejected: ${approval.reason || 'Not approved'}`,
            state: ToolCallState.FAILED,
          };

          results.push(rejectedResult);
          this.context?.addToolResult(rejectedResult);
          continue;
        }

        this.context?.audit('tool_approved', { reason: approval.reason }, undefined, toolCall.function.name);
      }

      // Execute tool
      toolCall.state = ToolCallState.EXECUTING;
      toolCall.startTime = new Date();

      // Emit tool start
      this.emit('tool:start', {
        executionId,
        iteration,
        toolCall,
        timestamp: new Date(),
      });

      const toolStartTime = Date.now();

      try {
        // Execute with timeout
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

        let toolResult: ToolResult = {
          tool_use_id: toolCall.id,
          content: result,
          state: ToolCallState.COMPLETED,
          executionTime: Date.now() - toolStartTime,
        };

        // Execute after:tool hook
        const afterTool = await this.hookManager.executeHooks('after:tool', {
          executionId,
          iteration,
          toolCall,
          result: toolResult,
          context: this.context!,
          timestamp: new Date(),
        }, {});

        // Apply result modifications
        if (afterTool.modified) {
          toolResult = { ...toolResult, ...afterTool.modified };
        }

        results.push(toolResult);
        this.context?.addToolResult(toolResult);

        // Update metrics
        this.context?.updateMetrics({
          toolDuration: (this.context.metrics.toolDuration || 0) + toolResult.executionTime!,
        });

        // Emit tool complete
        this.emit('tool:complete', {
          executionId,
          iteration,
          toolCall,
          result: toolResult,
          timestamp: new Date(),
        });
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
        this.context?.addToolResult(toolResult);

        // Record error
        this.context?.metrics.errors.push({
          type: 'tool_error',
          message: (error as Error).message,
          timestamp: new Date(),
        });

        // Emit tool error or timeout
        if (error instanceof ToolTimeoutError) {
          this.emit('tool:timeout', {
            executionId,
            iteration,
            toolCall,
            timeout: 30000,
            timestamp: new Date(),
          });
        } else {
          this.emit('tool:error', {
            executionId,
            iteration,
            toolCall,
            error: error as Error,
            timestamp: new Date(),
          });
        }
      }
    }

    return results;
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
            const isBlocking = toolDef?.blocking !== false;

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
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError('tool', timeoutMs));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
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
    const toolResultContents: ToolResultContent[] = toolResults.map((result) => ({
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

  /**
   * Pause execution (thread-safe with mutex)
   */
  pause(reason?: string): void {
    // Chain onto the mutex to ensure serialized access
    this.pauseResumeMutex = this.pauseResumeMutex.then(() => {
      this._doPause(reason);
    });
  }

  /**
   * Internal pause implementation
   */
  private _doPause(reason?: string): void {
    if (this.paused) return;

    this.paused = true;
    this.pausePromise = new Promise((resolve) => {
      this.resumeCallback = resolve;
    });

    if (this.context) {
      this.context.paused = true;
      this.context.pauseReason = reason;
      this.context.audit('execution_paused', { reason });
    }

    this.emit('execution:paused', {
      executionId: this.context?.executionId || 'unknown',
      reason: reason || 'Manual pause',
      timestamp: new Date(),
    });
  }

  /**
   * Resume execution (thread-safe with mutex)
   */
  resume(): void {
    // Chain onto the mutex to ensure serialized access
    this.pauseResumeMutex = this.pauseResumeMutex.then(() => {
      this._doResume();
    });
  }

  /**
   * Internal resume implementation
   */
  private _doResume(): void {
    if (!this.paused) return;

    this.paused = false;

    if (this.context) {
      this.context.paused = false;
      this.context.pauseReason = undefined;
      this.context.audit('execution_resumed', {});
    }

    if (this.resumeCallback) {
      this.resumeCallback();
      this.resumeCallback = null;
    }

    this.pausePromise = null;

    this.emit('execution:resumed', {
      executionId: this.context?.executionId || 'unknown',
      timestamp: new Date(),
    });
  }

  /**
   * Cancel execution
   */
  cancel(reason?: string): void {
    this.cancelled = true;

    if (this.context) {
      this.context.cancelled = true;
      this.context.cancelReason = reason;
    }

    // Resume if paused (to allow cancellation to proceed)
    // Use internal method directly to bypass mutex for immediate cancellation
    if (this.paused) {
      this._doResume();
    }

    this.emit('execution:cancelled', {
      executionId: this.context?.executionId || 'unknown',
      reason: reason || 'Manual cancellation',
      timestamp: new Date(),
    });
  }

  /**
   * Check if paused and wait
   */
  private async checkPause(): Promise<void> {
    if (this.paused && this.pausePromise) {
      await this.pausePromise;
    }
  }

  /**
   * Get current execution context
   */
  getContext(): ExecutionContext | null {
    return this.context;
  }

  /**
   * Check if currently executing
   */
  isRunning(): boolean {
    return this.context !== null && !this.cancelled;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Check if cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }
}
