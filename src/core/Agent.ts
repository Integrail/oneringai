/**
 * Agent - AI assistant bound to a Connector
 *
 * This is the main public API for creating and using agents.
 * Extends BaseAgent for shared functionality.
 *
 * The agentic loop (tool calling, iterations) is implemented directly
 * in this class for clarity and simplicity.
 */

import { randomUUID } from 'crypto';
import { BaseAgent, BaseAgentConfig, BaseSessionConfig } from './BaseAgent.js';
import { ExecutionContext, HistoryMode } from '../capabilities/agents/ExecutionContext.js';
import { HookManager } from '../capabilities/agents/HookManager.js';
import { InputItem, MessageRole, OutputItem } from '../domain/entities/Message.js';
import { AgentResponse } from '../domain/entities/Response.js';
import { StreamEvent, StreamEventType, isToolCallArgumentsDone } from '../domain/entities/StreamEvent.js';
import { StreamState } from '../domain/entities/StreamState.js';
import { Tool, ToolCall, ToolCallState, ToolResult } from '../domain/entities/Tool.js';
import { Content, ContentType } from '../domain/entities/Content.js';
import { ToolTimeoutError } from '../domain/errors/AIErrors.js';
import { HookConfig } from '../capabilities/agents/types/HookTypes.js';
import { AgentEvents } from '../capabilities/agents/types/EventTypes.js';
import { IDisposable, assertNotDestroyed } from '../domain/interfaces/IDisposable.js';
import { TextGenerateOptions } from '../domain/interfaces/ITextProvider.js';
import type { IContextStorage } from '../domain/interfaces/IContextStorage.js';
import type { PermissionCheckContext } from './permissions/types.js';
import { metrics } from '../infrastructure/observability/Metrics.js';
import { AgentContext } from './AgentContext.js';
import type { AgentContextConfig } from './AgentContext.js';
import type {
  IAgentDefinitionStorage,
  StoredAgentDefinition,
  AgentDefinitionMetadata,
} from '../domain/interfaces/IAgentDefinitionStorage.js';

/**
 * Session configuration for Agent (same as BaseSessionConfig)
 */
export type AgentSessionConfig = BaseSessionConfig;

/**
 * Agent configuration - extends BaseAgentConfig with Agent-specific options
 */
export interface AgentConfig extends BaseAgentConfig {
  /** System instructions for the agent */
  instructions?: string;

  /** Temperature for generation */
  temperature?: number;

  /** Maximum iterations for tool calling loop */
  maxIterations?: number;

  /** Vendor-specific options (e.g., Google's thinkingLevel: 'low' | 'high') */
  vendorOptions?: Record<string, unknown>;

  /**
   * Optional unified context management.
   * When provided (as AgentContext instance or config), Agent will:
   * - Track conversation history
   * - Cache tool results (if enabled)
   * - Provide unified memory access
   * - Support session persistence via context
   *
   * Pass an AgentContext instance or AgentContextConfig to enable.
   */
  context?: AgentContext | AgentContextConfig;

  /** Tool execution timeout in milliseconds. @default 30000 */
  toolTimeout?: number;

  // Enterprise features
  hooks?: HookConfig;
  historyMode?: HistoryMode;
  limits?: {
    maxExecutionTime?: number;
    maxToolCalls?: number;
    maxContextSize?: number;
    maxInputMessages?: number;
  };
  errorHandling?: {
    hookFailureMode?: 'fail' | 'warn' | 'ignore';
    toolFailureMode?: 'fail' | 'continue';
    maxConsecutiveErrors?: number;
  };
}

/**
 * Agent class - represents an AI assistant with tool calling capabilities
 *
 * Extends BaseAgent to inherit:
 * - Connector resolution
 * - Provider initialization
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 */
export class Agent extends BaseAgent<AgentConfig, AgentEvents> implements IDisposable {
  // ===== Agent-specific State =====
  private hookManager: HookManager;
  private executionContext: ExecutionContext | null = null;

  // Pause/resume/cancel state
  private _paused = false;
  private _cancelled = false;
  private _pausePromise: Promise<void> | null = null;
  private _resumeCallback: (() => void) | null = null;
  private _pauseResumeMutex: Promise<void> = Promise.resolve();

  // ===== Static Factory =====

  /**
   * Create a new agent
   *
   * @example
   * ```typescript
   * const agent = Agent.create({
   *   connector: 'openai',  // or Connector instance
   *   model: 'gpt-4',
   *   instructions: 'You are a helpful assistant',
   *   tools: [myTool]
   * });
   * ```
   */
  static create(config: AgentConfig): Agent {
    return new Agent(config);
  }

  /**
   * Resume an agent from a saved session
   *
   * @example
   * ```typescript
   * const agent = await Agent.resume('session-123', {
   *   connector: 'openai',
   *   model: 'gpt-4',
   *   session: { storage: myStorage }
   * });
   * ```
   */
  static async resume(
    sessionId: string,
    config: Omit<AgentConfig, 'session'> & { session: { storage: IContextStorage } }
  ): Promise<Agent> {
    const agent = new Agent({
      ...config,
      session: {
        ...config.session,
        id: sessionId,
      },
    });

    // Wait for session to load
    await agent.ensureSessionLoaded();

    return agent;
  }

  /**
   * Create an agent from a stored definition
   *
   * Loads agent configuration from storage and creates a new Agent instance.
   * The connector must be registered at runtime before calling this method.
   *
   * @param agentId - Agent identifier to load
   * @param storage - Storage backend to load from
   * @param overrides - Optional config overrides
   * @returns Agent instance, or null if not found
   */
  static async fromStorage(
    agentId: string,
    storage: IAgentDefinitionStorage,
    overrides?: Partial<AgentConfig>
  ): Promise<Agent | null> {
    const definition = await storage.load(agentId);
    if (!definition) {
      return null;
    }

    // Build config from definition
    const config: AgentConfig = {
      connector: definition.connector.name,
      model: definition.connector.model,
      instructions: definition.systemPrompt,
      context: {
        agentId: definition.agentId,
        systemPrompt: definition.systemPrompt,
        instructions: definition.instructions,
        features: definition.features,
      },
      ...definition.typeConfig,
      ...overrides,
    };

    return new Agent(config);
  }

  // ===== Constructor =====

  private constructor(config: AgentConfig) {
    super(config, 'Agent');

    this._logger.debug({ model: this.model, connector: this.connector.name }, 'Agent created');
    metrics.increment('agent.created', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    // Provider is inherited from BaseAgent (this._provider)

    // Set system prompt on inherited AgentContext if instructions provided
    if (config.instructions) {
      this._agentContext.systemPrompt = config.instructions;
    }

    // Sync tool permission configs from ToolManager (via AgentContext) to PermissionManager
    this._agentContext.tools.on('tool:registered', ({ name }) => {
      const permission = this._agentContext.tools.getPermission(name);
      if (permission) {
        this._permissionManager.setToolConfig(name, permission);
      }
    });

    // Create hook manager
    this.hookManager = new HookManager(
      config.hooks || {},
      this,
      config.errorHandling
    );

    // Initialize session (from BaseAgent)
    this.initializeSession(config.session);
  }

  // ===== Abstract Method Implementations =====

  protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent' {
    return 'agent';
  }

  // ===== Context Access =====

  // Note: `context` getter is inherited from BaseAgent (returns _agentContext)

  /**
   * Check if context management is enabled.
   * Always returns true since AgentContext is always created by BaseAgent.
   */
  hasContext(): boolean {
    return true;
  }

  // getContextState() and restoreContextState() are inherited from BaseAgent

  // ===== Main API =====

  /**
   * Run the agent with input
   */
  async run(input: string | InputItem[]): Promise<AgentResponse> {
    assertNotDestroyed(this, 'run agent');

    // Ensure any pending session load is complete
    await this.ensureSessionLoaded();

    const inputPreview = typeof input === 'string'
      ? input.substring(0, 100)
      : `${input.length} messages`;

    this._logger.info({ inputPreview, toolCount: this._config.tools?.length || 0 }, 'Agent run started');
    metrics.increment('agent.run.started', 1, { model: this.model, connector: this.connector.name });

    const startTime = Date.now();

    // Set current input for task type detection
    const userContent = typeof input === 'string'
      ? input
      : input.map(i => JSON.stringify(i)).join('\n');
    this._agentContext.setCurrentInput(userContent);

    // Generate execution ID and create execution context
    const executionId = `exec_${randomUUID()}`;
    this.executionContext = new ExecutionContext(executionId, {
      maxHistorySize: 10,
      historyMode: this._config.historyMode || 'summary',
      maxAuditTrailSize: 1000,
    });

    // Reset control state
    this._paused = false;
    this._cancelled = false;

    // Add user message to AgentContext
    if (typeof input === 'string') {
      this._agentContext.addUserMessage(input);
    } else {
      this._agentContext.addInputItems(input);
    }

    // Emit execution start
    this.emit('execution:start', {
      executionId,
      config: { model: this.model, maxIterations: this._config.maxIterations || 10 },
      timestamp: new Date(),
    });

    // Execute before:execution hook
    await this.hookManager.executeHooks('before:execution', {
      executionId,
      config: { model: this.model },
      timestamp: new Date(),
    }, undefined);

    let iteration = 0;
    let finalResponse: AgentResponse | null = null;

    try {
      const maxIterations = this._config.maxIterations || 10;

      while (iteration < maxIterations) {
        // Check pause
        await this.checkPause();

        // Check if cancelled
        if (this._cancelled) {
          throw new Error('Execution cancelled');
        }

        // Check resource limits
        this.executionContext.checkLimits(this._config.limits);

        // Check pause hook
        const pauseCheck = await this.hookManager.executeHooks('pause:check', {
          executionId,
          iteration,
          context: this.executionContext,
          timestamp: new Date(),
        }, { shouldPause: false });

        if (pauseCheck.shouldPause) {
          this.pause(pauseCheck.reason || 'Hook requested pause');
          await this.checkPause();
        }

        // Update iteration
        this.executionContext.iteration = iteration;

        // Emit iteration start
        this.emit('iteration:start', { executionId, iteration, timestamp: new Date() });

        const iterationStartTime = Date.now();

        // Prepare context (handles compaction)
        const prepared = await this._agentContext.prepareConversation({
          instructionOverride: this._config.instructions,
        });

        // Generate LLM response
        const response = await this.generateWithHooks(prepared.input, iteration, executionId);

        // Extract tool calls
        const toolCalls = this.extractToolCalls(response.output);

        // Add assistant response to AgentContext
        this._agentContext.addAssistantResponse(response.output);

        // Emit tool detection
        if (toolCalls.length > 0) {
          this.emit('tool:detected', { executionId, iteration, toolCalls, timestamp: new Date() });
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
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

        // Add tool results to AgentContext
        this._agentContext.addToolResults(toolResults);

        // Store iteration record
        this.executionContext.addIteration({
          iteration,
          request: {
            model: this.model,
            input: prepared.input,
            instructions: this._config.instructions,
            tools: this.getEnabledToolDefinitions(),
            temperature: this._config.temperature,
          },
          response,
          toolCalls,
          toolResults,
          startTime: new Date(iterationStartTime),
          endTime: new Date(),
        });

        // Update metrics
        this.executionContext.updateMetrics({
          iterationCount: iteration + 1,
          inputTokens: this.executionContext.metrics.inputTokens + (response.usage?.input_tokens || 0),
          outputTokens: this.executionContext.metrics.outputTokens + (response.usage?.output_tokens || 0),
          totalTokens: this.executionContext.metrics.totalTokens + (response.usage?.total_tokens || 0),
        });

        // Emit iteration complete
        this.emit('iteration:complete', {
          executionId,
          iteration,
          response,
          timestamp: new Date(),
          duration: Date.now() - iterationStartTime,
        });

        // Auto-cleanup consumed spills at end of iteration
        await this._agentContext.autoSpillPlugin?.onIteration();

        iteration++;
      }

      // Check if we exited normally or hit max iterations
      if (iteration >= maxIterations && !finalResponse) {
        throw new Error(`Max iterations (${maxIterations}) reached without completion`);
      }

      // Calculate total duration
      const totalDuration = Date.now() - this.executionContext.startTime.getTime();
      this.executionContext.updateMetrics({ totalDuration });

      // Execute after:execution hook
      await this.hookManager.executeHooks('after:execution', {
        executionId,
        response: finalResponse!,
        context: this.executionContext,
        timestamp: new Date(),
        duration: totalDuration,
      }, undefined);

      // Emit execution complete
      this.emit('execution:complete', {
        executionId,
        response: finalResponse!,
        timestamp: new Date(),
        duration: totalDuration,
      });

      const duration = Date.now() - startTime;
      this._logger.info({ duration }, 'Agent run completed');
      metrics.timing('agent.run.duration', duration, { model: this.model, connector: this.connector.name });
      metrics.increment('agent.run.completed', 1, { model: this.model, connector: this.connector.name, status: 'success' });

      return finalResponse!;
    } catch (error) {
      // Emit execution error
      this.emit('execution:error', { executionId, error: error as Error, timestamp: new Date() });

      // Record error in metrics
      this.executionContext?.metrics.errors.push({
        type: 'execution_error',
        message: (error as Error).message,
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      this._logger.error({ error: (error as Error).message, duration }, 'Agent run failed');
      metrics.increment('agent.run.completed', 1, { model: this.model, connector: this.connector.name, status: 'error' });

      throw error;
    } finally {
      // Always cleanup resources
      this.executionContext?.cleanup();
      this.hookManager.clear();
    }
  }

  /**
   * Stream response from the agent
   */
  async *stream(input: string | InputItem[]): AsyncIterableIterator<StreamEvent> {
    assertNotDestroyed(this, 'stream from agent');

    // Ensure any pending session load is complete
    await this.ensureSessionLoaded();

    const inputPreview = typeof input === 'string'
      ? input.substring(0, 100)
      : `${input.length} messages`;

    this._logger.info({ inputPreview, toolCount: this._config.tools?.length || 0 }, 'Agent stream started');
    metrics.increment('agent.stream.started', 1, { model: this.model, connector: this.connector.name });

    const startTime = Date.now();

    // Set current input for task type detection
    const userContent = typeof input === 'string'
      ? input
      : input.map(i => JSON.stringify(i)).join('\n');
    this._agentContext.setCurrentInput(userContent);

    // Generate execution ID and create execution context
    const executionId = `exec_${randomUUID()}`;
    this.executionContext = new ExecutionContext(executionId, {
      maxHistorySize: 10,
      historyMode: this._config.historyMode || 'summary',
      maxAuditTrailSize: 1000,
    });

    // Reset control state
    this._paused = false;
    this._cancelled = false;
    this._pausePromise = null;
    this._resumeCallback = null;

    // Add user message to AgentContext
    if (typeof input === 'string') {
      this._agentContext.addUserMessage(input);
    } else {
      this._agentContext.addInputItems(input);
    }

    // Create a single StreamState for the entire execution (tracks usage across iterations)
    const globalStreamState = new StreamState(executionId, this.model);

    let iteration = 0;

    try {
      // Emit execution start event
      this.emit('execution:start', {
        executionId,
        model: this.model,
        timestamp: new Date(),
      });

      // Execute before:execution hook
      await this.hookManager.executeHooks('before:execution', {
        executionId,
        config: { model: this.model },
        timestamp: new Date(),
      }, undefined);

      const maxIterations = this._config.maxIterations || 10;

      // Main agentic loop
      while (iteration < maxIterations) {
        iteration++;

        // Check pause state
        await this.checkPause();

        // Check if cancelled
        if (this._cancelled) {
          this.emit('execution:cancelled', { executionId, iteration, timestamp: new Date() });
          break;
        }

        // Check resource limits
        if (this.executionContext) {
          this.executionContext.checkLimits(this._config.limits);
        }

        // Execute pause:check hook
        const pauseCheck = await this.hookManager.executeHooks('pause:check', {
          executionId,
          iteration,
          context: this.executionContext!,
          timestamp: new Date(),
        }, { shouldPause: false });

        if (pauseCheck.shouldPause) {
          this.pause();
        }

        // Emit iteration start
        this.emit('iteration:start', { executionId, iteration, timestamp: new Date() });

        // Prepare context (handles compaction)
        const prepared = await this._agentContext.prepareConversation({
          instructionOverride: this._config.instructions,
        });

        // Stream LLM response and accumulate state (per-iteration state)
        const iterationStreamState = new StreamState(executionId, this.model);
        const toolCallsMap = new Map<string, { name: string; args: string }>();

        // Stream from provider with hooks
        yield* this.streamGenerateWithHooks(
          prepared.input,
          iteration,
          executionId,
          iterationStreamState,
          toolCallsMap
        );

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
          let parsedArgs: Record<string, unknown>;
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

            // Check tool failure mode
            const failureMode = this._config.errorHandling?.toolFailureMode || 'continue';
            if (failureMode === 'fail') {
              throw error;
            }

            // Continue mode: Add error result and continue
            toolResults.push({
              tool_use_id: toolCall.id,
              tool_name: toolCall.function.name,
              tool_args: parsedArgs,
              content: '',
              error: (error as Error).message,
              state: ToolCallState.FAILED,
            });
          }
        }

        // Build assistant message from stream state
        const assistantText = iterationStreamState.getAllText();
        const assistantContent: Content[] = [];
        if (assistantText && assistantText.trim()) {
          assistantContent.push({
            type: ContentType.OUTPUT_TEXT,
            text: assistantText,
          });
        }
        // Add tool use blocks
        for (const tc of toolCalls) {
          assistantContent.push({
            type: ContentType.TOOL_USE,
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
        }
        const assistantMessage: InputItem = {
          type: 'message',
          role: MessageRole.ASSISTANT,
          content: assistantContent,
        };

        // Add to AgentContext
        this._agentContext.addInputItems([assistantMessage]);
        this._agentContext.addToolResults(toolResults);

        // Auto-cleanup consumed spills at end of iteration
        await this._agentContext.autoSpillPlugin?.onIteration();

        // Yield iteration complete
        yield {
          type: StreamEventType.ITERATION_COMPLETE,
          response_id: executionId,
          iteration,
          tool_calls_count: toolCalls.length,
          has_more_iterations: true,
        };

        // Store iteration in context
        if (this.executionContext) {
          globalStreamState.incrementIteration();
        }

        // Clear per-iteration resources
        iterationStreamState.clear();
        toolCallsMap.clear();
      }

      // If loop ended due to max iterations, emit final completion
      if (iteration >= maxIterations) {
        yield {
          type: StreamEventType.RESPONSE_COMPLETE,
          response_id: executionId,
          status: 'incomplete',
          usage: globalStreamState.usage,
          iterations: iteration,
          duration_ms: Date.now() - startTime,
        };
      }

      // Execute after:execution hook with a placeholder response for streaming
      const streamingResponse: AgentResponse = {
        id: executionId,
        object: 'response',
        created_at: Math.floor(startTime / 1000),
        status: 'completed',
        model: this.model,
        output: [],
        usage: globalStreamState.usage,
      };
      await this.hookManager.executeHooks('after:execution', {
        executionId,
        response: streamingResponse,
        context: this.executionContext,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      }, undefined);

      // Emit execution complete
      this.emit('execution:complete', {
        executionId,
        iterations: iteration,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      });

      const duration = Date.now() - startTime;
      this._logger.info({ duration }, 'Agent stream completed');
      metrics.timing('agent.stream.duration', duration, { model: this.model, connector: this.connector.name });
      metrics.increment('agent.stream.completed', 1, { model: this.model, connector: this.connector.name, status: 'success' });
    } catch (error) {
      // Emit execution error
      this.emit('execution:error', { executionId, error: error as Error, timestamp: new Date() });

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

      const duration = Date.now() - startTime;
      this._logger.error({ error: (error as Error).message, duration }, 'Agent stream failed');
      metrics.increment('agent.stream.completed', 1, { model: this.model, connector: this.connector.name, status: 'error' });

      throw error;
    } finally {
      // Always cleanup resources
      globalStreamState.clear();
      this.executionContext?.cleanup();
      this.hookManager.clear();
    }
  }

  // ===== LLM Generation with Hooks =====

  /**
   * Generate LLM response with hooks
   */
  private async generateWithHooks(
    input: InputItem[],
    iteration: number,
    executionId: string
  ): Promise<AgentResponse> {
    const llmStartTime = Date.now();

    // Prepare options
    let generateOptions: TextGenerateOptions = {
      model: this.model,
      input,
      instructions: this._config.instructions,
      tools: this.getEnabledToolDefinitions(),
      tool_choice: 'auto',
      temperature: this._config.temperature,
      vendorOptions: this._config.vendorOptions,
    };

    // Execute before:llm hook
    const beforeLLM = await this.hookManager.executeHooks('before:llm', {
      executionId,
      iteration,
      options: generateOptions,
      context: this.executionContext!,
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
      const response = await this._provider.generate(generateOptions);

      const llmDuration = Date.now() - llmStartTime;

      // Update metrics
      this.executionContext?.updateMetrics({
        llmDuration: (this.executionContext.metrics.llmDuration || 0) + llmDuration,
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
        context: this.executionContext!,
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
   * Stream LLM response with hooks
   */
  private async *streamGenerateWithHooks(
    input: InputItem[],
    iteration: number,
    executionId: string,
    streamState: StreamState,
    toolCallsMap: Map<string, { name: string; args: string }>
  ): AsyncIterableIterator<StreamEvent> {
    const llmStartTime = Date.now();

    // Prepare options
    const generateOptions: TextGenerateOptions = {
      model: this.model,
      input,
      instructions: this._config.instructions,
      tools: this.getEnabledToolDefinitions(),
      tool_choice: 'auto',
      temperature: this._config.temperature,
      vendorOptions: this._config.vendorOptions,
    };

    // Execute before:llm hook
    await this.hookManager.executeHooks('before:llm', {
      executionId,
      iteration,
      options: generateOptions,
      context: this.executionContext!,
      timestamp: new Date(),
    }, {});

    // Emit LLM request event
    this.emit('llm:request', {
      executionId,
      iteration,
      model: this.model,
      timestamp: new Date(),
    });

    try {
      // Stream from provider
      for await (const event of this._provider.streamGenerate(generateOptions)) {
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
          // Don't yield provider's RESPONSE_COMPLETE - we emit our own at the end
          continue;
        }

        // Yield event to caller
        yield event;
      }

      // Update metrics
      if (this.executionContext) {
        this.executionContext.metrics.llmDuration += Date.now() - llmStartTime;
        this.executionContext.metrics.inputTokens += streamState.usage.input_tokens;
        this.executionContext.metrics.outputTokens += streamState.usage.output_tokens;
        this.executionContext.metrics.totalTokens += streamState.usage.total_tokens;
      }

      // Execute after:llm hook with a placeholder response for streaming
      const llmPlaceholderResponse: AgentResponse = {
        id: executionId,
        object: 'response',
        created_at: Math.floor(llmStartTime / 1000),
        status: 'completed',
        model: this.model,
        output: [],
        usage: streamState.usage,
      };
      await this.hookManager.executeHooks('after:llm', {
        executionId,
        iteration,
        response: llmPlaceholderResponse,
        context: this.executionContext!,
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

  // ===== Tool Execution =====

  /**
   * Extract tool calls from response output
   */
  private extractToolCalls(output: OutputItem[]): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const toolDefinitions = this.getEnabledToolDefinitions();

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
      this.executionContext?.addToolCall(toolCall);

      // Check pause before each tool
      await this.checkPause();

      // Execute before:tool hook
      const beforeTool = await this.hookManager.executeHooks('before:tool', {
        executionId,
        iteration,
        toolCall,
        context: this.executionContext!,
        timestamp: new Date(),
      }, {});

      // Check if tool should be skipped
      if (beforeTool.skip) {
        this.executionContext?.audit('tool_skipped', { toolCall }, undefined, toolCall.function.name);

        // Parse args for tracking
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments);
        } catch { /* ignore parse errors */ }

        const mockResult: ToolResult = {
          tool_use_id: toolCall.id,
          tool_name: toolCall.function.name,
          tool_args: parsedArgs,
          content: beforeTool.mockResult || '',
          state: ToolCallState.COMPLETED,
          executionTime: 0,
        };

        results.push(mockResult);
        this.executionContext?.addToolResult(mockResult);
        continue;
      }

      // Apply modifications if any
      if (beforeTool.modified) {
        Object.assign(toolCall, beforeTool.modified);
        this.executionContext?.audit('tool_modified', { modifications: beforeTool.modified }, undefined, toolCall.function.name);
      }

      // Execute tool
      try {
        const result = await this.executeToolWithHooks(toolCall, iteration, executionId);
        results.push(result);
        this.executionContext?.addToolResult(result);
      } catch (error) {
        // Parse args for tracking (even on error)
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments);
        } catch { /* ignore parse errors */ }

        const toolResult: ToolResult = {
          tool_use_id: toolCall.id,
          tool_name: toolCall.function.name,
          tool_args: parsedArgs,
          content: '',
          error: (error as Error).message,
          state: ToolCallState.FAILED,
        };

        results.push(toolResult);
        this.executionContext?.addToolResult(toolResult);

        // Check tool failure mode
        const failureMode = this._config.errorHandling?.toolFailureMode || 'continue';
        if (failureMode === 'fail') {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Execute single tool with hooks
   */
  private async executeToolWithHooks(
    toolCall: ToolCall,
    iteration: number,
    executionId: string
  ): Promise<ToolResult> {
    const toolStartTime = Date.now();

    toolCall.state = ToolCallState.EXECUTING;
    toolCall.startTime = new Date();

    // Permission check
    const permissionApproved = await this.checkToolPermission(toolCall, iteration, executionId);

    // Execute approve:tool hook if needed
    if (!permissionApproved || this.hookManager.hasHooks('approve:tool')) {
      const approval = await this.hookManager.executeHooks('approve:tool', {
        executionId,
        iteration,
        toolCall,
        context: this.executionContext!,
        timestamp: new Date(),
      }, { approved: permissionApproved });

      if (!approval.approved) {
        throw new Error(`Tool execution rejected: ${approval.reason || 'No reason provided'}`);
      }
    }

    // Emit tool start
    this.emit('tool:start', { executionId, iteration, toolCall, timestamp: new Date() });

    try {
      // Execute with timeout
      const args = JSON.parse(toolCall.function.arguments);
      const timeout = this._config.toolTimeout ?? 30000;
      const result = await this.executeWithTimeout(
        () => this._agentContext.tools.execute(toolCall.function.name, args),
        timeout
      );

      toolCall.state = ToolCallState.COMPLETED;
      toolCall.endTime = new Date();

      let toolResult: ToolResult = {
        tool_use_id: toolCall.id,
        tool_name: toolCall.function.name,
        tool_args: args,
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
        context: this.executionContext!,
        timestamp: new Date(),
      }, {});

      // Apply result modifications
      if (afterTool.modified) {
        toolResult = { ...toolResult, ...afterTool.modified };
      }

      // AutoSpill & ToolOutput Plugin Integration
      // CRITICAL: AutoSpill MUST run BEFORE ToolOutputPlugin.addOutput()
      // so that large outputs are replaced with pointers before being tracked
      if (toolResult.content) {
        let finalContent = toolResult.content;

        // Auto-spill large outputs to memory FIRST (if enabled)
        const autoSpillPlugin = this._agentContext.autoSpillPlugin;
        if (autoSpillPlugin) {
          const outputStr = typeof finalContent === 'string'
            ? finalContent
            : JSON.stringify(finalContent);
          const outputSize = Buffer.byteLength(outputStr, 'utf8');

          if (autoSpillPlugin.shouldSpill(toolCall.function.name, outputSize)) {
            const spillKey = await autoSpillPlugin.onToolOutput(
              toolCall.function.name,
              finalContent
            );
            if (spillKey) {
              (toolResult as ToolResult & { spilledKey?: string }).spilledKey = spillKey;
              finalContent = `[Large output (${Math.round(outputSize / 1024)}KB) spilled to memory: ${spillKey}. Use memory_retrieve to access.]`;
              toolResult.content = finalContent;
            }
          }
        }

        // THEN track in tool output plugin (gets spill pointer if applicable)
        this._agentContext.toolOutputPlugin?.addOutput(toolCall.function.name, finalContent);
      }

      // Update metrics
      if (this.executionContext) {
        this.executionContext.metrics.toolCallCount++;
        this.executionContext.metrics.toolSuccessCount++;
        this.executionContext.metrics.toolDuration += toolResult.executionTime || 0;
      }

      // Emit tool complete
      this.emit('tool:complete', { executionId, iteration, toolCall, result: toolResult, timestamp: new Date() });

      return toolResult;
    } catch (error) {
      toolCall.state = ToolCallState.FAILED;
      toolCall.endTime = new Date();
      toolCall.error = (error as Error).message;

      // Update metrics
      if (this.executionContext) {
        this.executionContext.metrics.toolFailureCount++;
      }

      // Emit tool error or timeout
      if (error instanceof ToolTimeoutError) {
        this.emit('tool:timeout', {
          executionId,
          iteration,
          toolCall,
          timeout: this._config.toolTimeout ?? 30000,
          timestamp: new Date(),
        });
      } else {
        this.emit('tool:error', { executionId, iteration, toolCall, error: error as Error, timestamp: new Date() });
      }

      throw error;
    }
  }

  /**
   * Check tool permission before execution
   */
  private async checkToolPermission(
    toolCall: ToolCall,
    iteration: number,
    executionId: string
  ): Promise<boolean> {
    // Check if blocked first
    if (this._permissionManager.isBlocked(toolCall.function.name)) {
      this.executionContext?.audit('tool_blocked', { reason: 'Tool is blocklisted' }, undefined, toolCall.function.name);
      throw new Error(`Tool "${toolCall.function.name}" is blocked and cannot be executed`);
    }

    // Check if already approved
    if (this._permissionManager.isApproved(toolCall.function.name)) {
      return true;
    }

    // Check if needs approval
    const checkResult = this._permissionManager.checkPermission(toolCall.function.name);
    if (!checkResult.needsApproval) {
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
      agentType: 'agent',
    };

    // Request approval via permission manager's callback
    const decision = await this._permissionManager.requestApproval(context);

    if (decision.approved) {
      this.executionContext?.audit('tool_permission_approved', {
        scope: decision.scope,
        approvedBy: decision.approvedBy,
      }, undefined, toolCall.function.name);
      return true;
    }

    return false;
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

  // ===== Pause/Resume/Cancel =====

  /**
   * Pause execution
   */
  pause(reason?: string): void {
    this._pauseResumeMutex = this._pauseResumeMutex.then(() => {
      if (this._paused) return;

      this._paused = true;
      this._pausePromise = new Promise((resolve) => {
        this._resumeCallback = resolve;
      });

      if (this.executionContext) {
        this.executionContext.paused = true;
        this.executionContext.pauseReason = reason;
        this.executionContext.audit('execution_paused', { reason });
      }

      this.emit('execution:paused', {
        executionId: this.executionContext?.executionId || 'unknown',
        reason: reason || 'Manual pause',
        timestamp: new Date(),
      });
    });
  }

  /**
   * Resume execution
   */
  resume(): void {
    this._pauseResumeMutex = this._pauseResumeMutex.then(() => {
      if (!this._paused) return;

      this._paused = false;

      if (this.executionContext) {
        this.executionContext.paused = false;
        this.executionContext.pauseReason = undefined;
        this.executionContext.audit('execution_resumed', {});
      }

      if (this._resumeCallback) {
        this._resumeCallback();
        this._resumeCallback = null;
      }

      this._pausePromise = null;

      this.emit('execution:resumed', {
        executionId: this.executionContext?.executionId || 'unknown',
        timestamp: new Date(),
      });
    });
  }

  /**
   * Cancel execution
   */
  cancel(reason?: string): void {
    this._cancelled = true;

    if (this.executionContext) {
      this.executionContext.cancelled = true;
      this.executionContext.cancelReason = reason;
    }

    // Resume if paused (to allow cancellation to proceed)
    if (this._paused) {
      this._paused = false;
      if (this._resumeCallback) {
        this._resumeCallback();
        this._resumeCallback = null;
      }
      this._pausePromise = null;
    }

    this.emit('execution:cancelled', {
      executionId: this.executionContext?.executionId || 'unknown',
      reason: reason || 'Manual cancellation',
      timestamp: new Date(),
    });
  }

  /**
   * Check if paused and wait
   */
  private async checkPause(): Promise<void> {
    if (this._paused && this._pausePromise) {
      await this._pausePromise;
    }
  }

  // ===== Tool Management =====
  // Note: addTool, removeTool, listTools, setTools are inherited from BaseAgent

  // ===== Permission Convenience Methods =====

  approveToolForSession(toolName: string): void {
    this._permissionManager.approveForSession(toolName);
  }

  revokeToolApproval(toolName: string): void {
    this._permissionManager.revoke(toolName);
  }

  getApprovedTools(): string[] {
    return this._permissionManager.getApprovedTools();
  }

  toolNeedsApproval(toolName: string): boolean {
    return this._permissionManager.checkPermission(toolName).needsApproval;
  }

  toolIsBlocked(toolName: string): boolean {
    return this._permissionManager.isBlocked(toolName);
  }

  allowlistTool(toolName: string): void {
    this._permissionManager.allowlistAdd(toolName);
  }

  blocklistTool(toolName: string): void {
    this._permissionManager.blocklistAdd(toolName);
  }

  // ===== Configuration Methods =====

  setModel(model: string): void {
    (this as { model: string }).model = model;
    this._config.model = model;
  }

  getTemperature(): number | undefined {
    return this._config.temperature;
  }

  setTemperature(temperature: number): void {
    this._config.temperature = temperature;
  }

  // ===== Definition Persistence =====

  async saveDefinition(
    storage: IAgentDefinitionStorage,
    metadata?: AgentDefinitionMetadata
  ): Promise<void> {
    const now = new Date().toISOString();

    const definition: StoredAgentDefinition = {
      version: 1,
      agentId: this._agentContext.agentId,
      name: this._agentContext.agentId,
      agentType: 'agent',
      createdAt: now,
      updatedAt: now,
      connector: {
        name: this.connector.name,
        model: this.model,
      },
      systemPrompt: this._agentContext.systemPrompt,
      instructions: this._config.instructions,
      features: this._agentContext.features,
      metadata,
      typeConfig: {
        temperature: this._config.temperature,
        maxIterations: this._config.maxIterations,
        vendorOptions: this._config.vendorOptions,
      },
    };

    await storage.save(definition);
  }

  // ===== Introspection =====

  getExecutionContext(): ExecutionContext | null {
    return this.executionContext;
  }

  /**
   * Alias for getExecutionContext() for backward compatibility
   */
  getContext(): ExecutionContext | null {
    return this.executionContext;
  }

  getMetrics() {
    return this.executionContext?.metrics || null;
  }

  getSummary() {
    return this.executionContext?.getSummary() || null;
  }

  getAuditTrail() {
    return this.executionContext?.getAuditTrail() || [];
  }

  getProviderCircuitBreakerMetrics() {
    if ('getCircuitBreakerMetrics' in this._provider) {
      return (this._provider as { getCircuitBreakerMetrics: () => unknown }).getCircuitBreakerMetrics();
    }
    return null;
  }

  getToolCircuitBreakerStates() {
    return this._agentContext.tools.getCircuitBreakerStates();
  }

  getToolCircuitBreakerMetrics(toolName: string) {
    return this._agentContext.tools.getToolCircuitBreakerMetrics(toolName);
  }

  resetToolCircuitBreaker(toolName: string): void {
    this._agentContext.tools.resetToolCircuitBreaker(toolName);
    this._logger.info({ toolName }, 'Tool circuit breaker reset by user');
  }

  isRunning(): boolean {
    return this.executionContext !== null && !this._cancelled;
  }

  isPaused(): boolean {
    return this._paused;
  }

  isCancelled(): boolean {
    return this._cancelled;
  }

  // ===== Cleanup =====

  destroy(): void {
    if (this._isDestroyed) {
      return;
    }

    this._logger.debug('Agent destroy started');

    // Cancel any ongoing execution
    try {
      this.cancel('Agent destroyed');
    } catch {
      // Ignore errors during cancel
    }

    // Cleanup execution context
    this.executionContext?.cleanup();
    this.executionContext = null;

    // Note: AgentContext cleanup is handled by baseDestroy() in BaseAgent

    // Run cleanup callbacks
    for (const callback of this._cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        this._logger.error({ error: (error as Error).message }, 'Cleanup callback error');
      }
    }
    this._cleanupCallbacks = [];

    // Call base destroy (handles session, tool manager, permission manager cleanup)
    this.baseDestroy();

    metrics.increment('agent.destroyed', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    this._logger.debug('Agent destroyed');
  }
}
