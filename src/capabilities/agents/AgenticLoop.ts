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
import type { ToolPermissionManager } from '../../core/permissions/ToolPermissionManager.js';
import type { PermissionCheckContext } from '../../core/permissions/types.js';

export interface AgenticLoopConfig {
  model: string;
  input: string | InputItem[];
  instructions?: string;
  tools: Tool[];
  temperature?: number;
  maxIterations: number;
  /** Vendor-specific options (e.g., Google's thinkingLevel) */
  vendorOptions?: Record<string, any>;

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
    /**
     * Tool failure handling mode:
     * - 'fail': Stop execution on first tool failure (throw error)
     * - 'continue': Execute all tools even if some fail, return all results including errors
     * @default 'continue'
     */
    toolFailureMode?: 'fail' | 'continue';
    maxConsecutiveErrors?: number;
  };

  /**
   * Tool execution timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  toolTimeout?: number;

  /**
   * Permission manager for tool approval/blocking.
   * If provided, permission checks run BEFORE approve:tool hooks.
   */
  permissionManager?: ToolPermissionManager;

  /**
   * Agent type for permission context (used by TaskAgent/UniversalAgent).
   * @default 'agent'
   */
  agentType?: 'agent' | 'task-agent' | 'universal-agent';

  /**
   * Current task name (used for TaskAgent/UniversalAgent context).
   */
  taskName?: string;
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
        const toolResults = await this.executeToolsWithHooks(toolCalls, iteration, executionId, config);

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

        // Build next input - append to existing context (preserve history)
        const newMessages = this.buildNewMessages(response.output, toolResults);
        currentInput = this.appendToContext(currentInput, newMessages);

        // Apply sliding window to prevent unbounded input growth
        const maxInputMessages = config.limits?.maxInputMessages ?? 50;
        currentInput = this.applySlidingWindow(currentInput, maxInputMessages);

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
            const result = await this.executeToolWithHooks(toolCall, iteration, executionId, config);
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

            // Check tool failure mode - unified with execute() behavior
            const failureMode = config.errorHandling?.toolFailureMode || 'continue';
            if (failureMode === 'fail') {
              throw error; // Fail-fast mode: stop execution on first tool failure
            }

            // Continue mode (default): Add error result and continue with remaining tools
            toolResults.push({
              tool_use_id: toolCall.id,
              content: '',
              error: (error as Error).message,
              state: ToolCallState.FAILED,
            });
          }
        }

        // Build next input with tool results (streaming constructs messages from StreamState)
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

        // Update current input for next iteration using shared methods
        const newMessages: InputItem[] = [assistantMessage, toolResultsMessage];
        currentInput = this.appendToContext(currentInput, newMessages);

        // Apply sliding window to prevent unbounded input growth
        const maxInputMessages = config.limits?.maxInputMessages ?? 50;
        currentInput = this.applySlidingWindow(currentInput, maxInputMessages);

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
      vendorOptions: config.vendorOptions,
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
   * Check tool permission before execution
   * Returns true if approved, throws if blocked/rejected
   * @private
   */
  private async checkToolPermission(
    toolCall: ToolCall,
    iteration: number,
    executionId: string,
    config: AgenticLoopConfig
  ): Promise<boolean> {
    const permissionManager = config.permissionManager;
    if (!permissionManager) {
      // No permission manager - skip permission checks (backward compatible)
      return true;
    }

    const toolName = toolCall.function.name;

    // Check if blocked first
    if (permissionManager.isBlocked(toolName)) {
      this.context?.audit('tool_blocked', { reason: 'Tool is blocklisted' }, undefined, toolName);
      throw new Error(`Tool "${toolName}" is blocked and cannot be executed`);
    }

    // Check if already approved (allowlisted or session-approved)
    if (permissionManager.isApproved(toolName)) {
      return true;
    }

    // Check if needs approval
    const checkResult = permissionManager.checkPermission(toolName);
    if (!checkResult.needsApproval) {
      // Allowed without approval
      return true;
    }

    // Parse arguments for context
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      // Use empty args if parsing fails
    }

    // Build permission context
    const context: PermissionCheckContext = {
      toolCall,
      parsedArgs,
      config: checkResult.config || {},
      executionId,
      iteration,
      agentType: config.agentType || 'agent',
      taskName: config.taskName,
    };

    // Request approval via permission manager's callback
    const decision = await permissionManager.requestApproval(context);

    if (decision.approved) {
      this.context?.audit('tool_permission_approved', {
        scope: decision.scope,
        approvedBy: decision.approvedBy,
      }, undefined, toolName);
      return true;
    }

    // Not approved - but might need external approval via hooks
    // Return false to indicate hooks should be used
    return false;
  }

  /**
   * Execute single tool with hooks
   * @private
   */
  private async executeToolWithHooks(
    toolCall: ToolCall,
    iteration: number,
    executionId: string,
    config: AgenticLoopConfig
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

    // === NEW: Permission check (runs BEFORE approve:tool hooks) ===
    // If permission manager exists and has an approval callback, use it first
    const permissionApproved = await this.checkToolPermission(toolCall, iteration, executionId, config);

    // Execute approve:tool hook if registered AND permission check didn't auto-approve
    // (hooks provide additional approval logic beyond the permission system)
    if (!permissionApproved || this.hookManager.hasHooks('approve:tool')) {
      const approval = await this.hookManager.executeHooks('approve:tool', {
        executionId,
        iteration,
        toolCall,
        context: this.context!,
        timestamp: new Date(),
      }, { approved: permissionApproved }); // Default to permission result

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
      // Execute tool with timeout (configurable)
      const args = JSON.parse(toolCall.function.arguments);
      const result = await this.executeWithTimeout(
        () => this.toolExecutor.execute(toolCall.function.name, args),
        config.toolTimeout ?? 30000
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
      vendorOptions: config.vendorOptions,
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
    executionId: string,
    config: AgenticLoopConfig
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

      // === NEW: Permission check (runs BEFORE approve:tool hooks) ===
      let permissionApproved = true;
      try {
        permissionApproved = await this.checkToolPermission(toolCall, iteration, executionId, config);
      } catch (error) {
        // Tool is blocked
        this.context?.audit('tool_blocked', { reason: (error as Error).message }, undefined, toolCall.function.name);

        const blockedResult: ToolResult = {
          tool_use_id: toolCall.id,
          content: '',
          error: (error as Error).message,
          state: ToolCallState.FAILED,
        };

        results.push(blockedResult);
        this.context?.addToolResult(blockedResult);
        continue;
      }

      // Execute approve:tool hook (if exists AND permission check didn't auto-approve)
      if (!permissionApproved || this.hookManager.hasHooks('approve:tool')) {
        const approval = await this.hookManager.executeHooks('approve:tool', {
          executionId,
          iteration,
          toolCall,
          context: this.context!,
          timestamp: new Date(),
        }, { approved: permissionApproved }); // Default to permission result

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
        // Execute with timeout (configurable)
        const timeout = config.toolTimeout ?? 30000;
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
            timeout: config.toolTimeout ?? 30000,
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

        // Check tool failure mode
        const failureMode = config.errorHandling?.toolFailureMode || 'continue';
        if (failureMode === 'fail') {
          // Fail-fast mode: stop execution on first tool failure
          throw error;
        }

        // Continue mode (default): Continue executing remaining tools
        // Error already added to results above
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

  // ============ Shared Helper Methods ============
  // These methods provide unified logic for both execute() and executeStreaming()

  /**
   * Build new messages from tool results (assistant response + tool results)
   */
  private buildNewMessages(
    previousOutput: OutputItem[],
    toolResults: ToolResult[]
  ): InputItem[] {
    const messages: InputItem[] = [];

    // Add assistant's previous response as input
    for (const item of previousOutput) {
      if (item.type === 'message') {
        messages.push(item);
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
      messages.push({
        type: 'message',
        role: MessageRole.USER,
        content: toolResultContents,
      });
    }

    return messages;
  }

  /**
   * Append new messages to current context, preserving history
   * Unified logic for both execute() and executeStreaming()
   */
  private appendToContext(
    currentInput: string | InputItem[],
    newMessages: InputItem[]
  ): InputItem[] {
    if (Array.isArray(currentInput)) {
      return [...currentInput, ...newMessages];
    }

    // First iteration - convert string input to array format
    return [
      {
        type: 'message' as const,
        role: MessageRole.USER,
        content: [{ type: ContentType.INPUT_TEXT, text: currentInput }],
      },
      ...newMessages,
    ];
  }

  /**
   * Apply sliding window to prevent unbounded input growth
   * Preserves system/developer message at the start if present
   * IMPORTANT: Ensures tool_use and tool_result pairs are never broken
   */
  private applySlidingWindow(
    input: InputItem[],
    maxMessages: number = 50
  ): InputItem[] {
    if (input.length <= maxMessages) {
      return input;
    }

    // Check if first message is a developer/system message
    const firstMessage = input[0];
    const isSystemMessage = firstMessage?.type === 'message' &&
      firstMessage.role === MessageRole.DEVELOPER;

    // Calculate how many messages we can keep (excluding system message if present)
    const maxToKeep = isSystemMessage ? maxMessages - 1 : maxMessages;

    // Find a safe cut point that doesn't break tool call/result pairs
    const safeCutIndex = this.findSafeToolBoundary(input, input.length - maxToKeep);

    // Slice from safe cut point to end
    const recentMessages = input.slice(safeCutIndex);

    if (isSystemMessage) {
      return [firstMessage, ...recentMessages];
    }

    return recentMessages;
  }

  /**
   * Find a safe index to cut the message array without breaking tool call/result pairs
   * A safe boundary is one where all tool_use IDs have matching tool_result IDs
   */
  private findSafeToolBoundary(input: InputItem[], targetIndex: number): number {
    // Ensure we don't go below 0 or above the array length
    let cutIndex = Math.max(0, Math.min(targetIndex, input.length - 1));

    // Start from targetIndex and search forward for a safe boundary
    // A safe boundary is where we don't have orphaned tool calls or results
    while (cutIndex < input.length - 1) {
      if (this.isToolBoundarySafe(input, cutIndex)) {
        return cutIndex;
      }
      cutIndex++;
    }

    // If no safe boundary found going forward, try going backward
    cutIndex = Math.max(0, targetIndex);
    while (cutIndex > 0) {
      if (this.isToolBoundarySafe(input, cutIndex)) {
        return cutIndex;
      }
      cutIndex--;
    }

    // Fallback: return original target (may cause issues but better than infinite loop)
    return Math.max(0, targetIndex);
  }

  /**
   * Check if cutting at this index would leave tool calls/results balanced
   * Returns true if all tool_use IDs in the slice have matching tool_result IDs
   */
  private isToolBoundarySafe(input: InputItem[], startIndex: number): boolean {
    const slicedMessages = input.slice(startIndex);

    // Collect all tool_use IDs and tool_result IDs in the slice
    const toolUseIds = new Set<string>();
    const toolResultIds = new Set<string>();

    for (const item of slicedMessages) {
      if (item.type !== 'message') continue;

      for (const content of item.content) {
        if (content.type === ContentType.TOOL_USE) {
          toolUseIds.add(content.id);
        } else if (content.type === ContentType.TOOL_RESULT) {
          toolResultIds.add(content.tool_use_id);
        }
      }
    }

    // Check 1: Every tool_result must have a matching tool_use
    // (tool_result without tool_use = API error)
    for (const resultId of toolResultIds) {
      if (!toolUseIds.has(resultId)) {
        return false;
      }
    }

    // Check 2: Every tool_use should have a matching tool_result
    // (tool_use without tool_result = incomplete, but less critical for some APIs)
    // However, for safety, we enforce this too
    for (const useId of toolUseIds) {
      if (!toolResultIds.has(useId)) {
        // Exception: the LAST assistant message may have tool_use without result yet
        // This is only safe if it's the very last message (current iteration)
        const lastMessage = slicedMessages[slicedMessages.length - 1];
        const isLastMessageWithThisToolUse =
          lastMessage?.type === 'message' &&
          lastMessage.role === MessageRole.ASSISTANT &&
          lastMessage.content.some(
            (c: any) => c.type === ContentType.TOOL_USE && c.id === useId
          );

        if (!isLastMessageWithThisToolUse) {
          return false;
        }
      }
    }

    return true;
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
