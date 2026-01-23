/**
 * Agent - AI assistant bound to a Connector
 *
 * This is the main public API for creating and using agents.
 * Replaces the old OneRingAI → AgentManager → Agent flow.
 */

import { EventEmitter } from 'eventemitter3';
import { Connector } from './Connector.js';
import { createProvider } from './createProvider.js';
import { ToolRegistry } from '../capabilities/agents/ToolRegistry.js';
import { AgenticLoop, AgenticLoopConfig } from '../capabilities/agents/AgenticLoop.js';
import { ExecutionContext, HistoryMode } from '../capabilities/agents/ExecutionContext.js';
import { ToolFunction } from '../domain/entities/Tool.js';
import { InputItem } from '../domain/entities/Message.js';
import { AgentResponse } from '../domain/entities/Response.js';
import { StreamEvent } from '../domain/entities/StreamEvent.js';
import { HookConfig } from '../capabilities/agents/types/HookTypes.js';
import { AgenticLoopEvents } from '../capabilities/agents/types/EventTypes.js';
import { IDisposable, assertNotDestroyed } from '../domain/interfaces/IDisposable.js';
import { ITextProvider } from '../domain/interfaces/ITextProvider.js';
import { logger, FrameworkLogger } from '../infrastructure/observability/Logger.js';
import { metrics } from '../infrastructure/observability/Metrics.js';

/**
 * Agent configuration - new simplified interface
 */
export interface AgentConfig {
  // Required: connector (name or instance)
  connector: string | Connector;

  // Required: model to use
  model: string;

  // Optional
  name?: string;
  instructions?: string;
  tools?: ToolFunction[];
  temperature?: number;
  maxIterations?: number;

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
 */
export class Agent extends EventEmitter<AgenticLoopEvents> implements IDisposable {
  // ============ Instance Properties ============

  readonly name: string;
  readonly connector: Connector;
  readonly model: string;

  private config: AgentConfig;
  private provider: ITextProvider;
  private toolRegistry: ToolRegistry;
  private agenticLoop: AgenticLoop;
  private cleanupCallbacks: Array<() => void> = [];
  private boundListeners: Map<keyof AgenticLoopEvents, (...args: any[]) => void> = new Map();
  private _isDestroyed = false;
  private logger: FrameworkLogger;

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  // ============ Static Factory ============

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

  // ============ Constructor ============

  private constructor(config: AgentConfig) {
    super();

    // Resolve connector
    this.connector =
      typeof config.connector === 'string'
        ? Connector.get(config.connector)
        : config.connector;

    this.name = config.name ?? `agent-${Date.now()}`;
    this.model = config.model;
    this.config = config;

    // Create logger with agent context
    this.logger = logger.child({
      component: 'Agent',
      agentName: this.name,
      model: this.model,
      connector: this.connector.name,
    });

    this.logger.debug({ config }, 'Agent created');
    metrics.increment('agent.created', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    // Create provider from connector
    this.provider = createProvider(this.connector);

    // Create tool registry
    this.toolRegistry = new ToolRegistry();
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolRegistry.registerTool(tool);
      }
    }

    // Create agentic loop
    this.agenticLoop = new AgenticLoop(
      this.provider,
      this.toolRegistry,
      config.hooks,
      config.errorHandling
    );

    // Forward events from AgenticLoop
    this.setupEventForwarding();
  }

  // ============ Main API ============

  /**
   * Run the agent with input
   */
  async run(input: string | InputItem[]): Promise<AgentResponse> {
    assertNotDestroyed(this, 'run agent');

    const inputPreview = typeof input === 'string'
      ? input.substring(0, 100)
      : `${input.length} messages`;

    this.logger.info({
      inputPreview,
      toolCount: this.config.tools?.length || 0,
    }, 'Agent run started');

    metrics.increment('agent.run.started', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    const startTime = Date.now();

    try {
      const tools = this.config.tools?.map((t) => t.definition) || [];

      const loopConfig: AgenticLoopConfig = {
        model: this.model,
        input,
        instructions: this.config.instructions,
        tools,
        temperature: this.config.temperature,
        maxIterations: this.config.maxIterations || 10,
        hooks: this.config.hooks,
        historyMode: this.config.historyMode,
        limits: this.config.limits,
        errorHandling: this.config.errorHandling,
      };

      const response = await this.agenticLoop.execute(loopConfig);

      const duration = Date.now() - startTime;

      this.logger.info({
        duration,
      }, 'Agent run completed');

      metrics.timing('agent.run.duration', duration, {
        model: this.model,
        connector: this.connector.name,
      });

      metrics.increment('agent.run.completed', 1, {
        model: this.model,
        connector: this.connector.name,
        status: 'success',
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error({
        error: (error as Error).message,
        duration,
      }, 'Agent run failed');

      metrics.increment('agent.run.completed', 1, {
        model: this.model,
        connector: this.connector.name,
        status: 'error',
      });

      throw error;
    }
  }

  /**
   * Stream response from the agent
   */
  async *stream(input: string | InputItem[]): AsyncIterableIterator<StreamEvent> {
    assertNotDestroyed(this, 'stream from agent');

    const inputPreview = typeof input === 'string'
      ? input.substring(0, 100)
      : `${input.length} messages`;

    this.logger.info({
      inputPreview,
      toolCount: this.config.tools?.length || 0,
    }, 'Agent stream started');

    metrics.increment('agent.stream.started', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    const startTime = Date.now();

    try {
      const tools = this.config.tools?.map((t) => t.definition) || [];

      const loopConfig: AgenticLoopConfig = {
        model: this.model,
        input,
        instructions: this.config.instructions,
        tools,
        temperature: this.config.temperature,
        maxIterations: this.config.maxIterations || 10,
        hooks: this.config.hooks,
        historyMode: this.config.historyMode,
        limits: this.config.limits,
        errorHandling: this.config.errorHandling,
      };

      yield* this.agenticLoop.executeStreaming(loopConfig);

      const duration = Date.now() - startTime;

      this.logger.info({ duration }, 'Agent stream completed');

      metrics.timing('agent.stream.duration', duration, {
        model: this.model,
        connector: this.connector.name,
      });

      metrics.increment('agent.stream.completed', 1, {
        model: this.model,
        connector: this.connector.name,
        status: 'success',
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error({
        error: (error as Error).message,
        duration,
      }, 'Agent stream failed');

      metrics.increment('agent.stream.completed', 1, {
        model: this.model,
        connector: this.connector.name,
        status: 'error',
      });

      throw error;
    }
  }

  // ============ Tool Management ============

  /**
   * Add a tool to the agent
   */
  addTool(tool: ToolFunction): void {
    this.toolRegistry.registerTool(tool);
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
    if (this.config.tools) {
      this.config.tools = this.config.tools.filter(
        (t) => t.definition.function.name !== toolName
      );
    }
  }

  /**
   * List registered tools
   */
  listTools(): string[] {
    return this.toolRegistry.listTools();
  }

  /**
   * Replace all tools with a new array
   */
  setTools(tools: ToolFunction[]): void {
    // Clear existing tools
    for (const name of this.toolRegistry.listTools()) {
      this.toolRegistry.unregisterTool(name);
    }
    // Register new tools
    for (const tool of tools) {
      this.toolRegistry.registerTool(tool);
    }
    this.config.tools = [...tools];
  }

  // ============ Configuration Methods ============

  /**
   * Change the model
   */
  setModel(model: string): void {
    (this as { model: string }).model = model;
    this.config.model = model;
  }

  /**
   * Get current temperature
   */
  getTemperature(): number | undefined {
    return this.config.temperature;
  }

  /**
   * Change the temperature
   */
  setTemperature(temperature: number): void {
    this.config.temperature = temperature;
  }

  // ============ Control Methods ============

  pause(reason?: string): void {
    this.agenticLoop.pause(reason);
  }

  resume(): void {
    this.agenticLoop.resume();
  }

  cancel(reason?: string): void {
    this.agenticLoop.cancel(reason);
  }

  // ============ Introspection ============

  getContext(): ExecutionContext | null {
    return this.agenticLoop.getContext();
  }

  getMetrics() {
    const context = this.agenticLoop.getContext();
    return context?.metrics || null;
  }

  getSummary() {
    const context = this.agenticLoop.getContext();
    return context?.getSummary() || null;
  }

  getAuditTrail() {
    const context = this.agenticLoop.getContext();
    return context?.getAuditTrail() || [];
  }

  /**
   * Get circuit breaker metrics for LLM provider
   */
  getProviderCircuitBreakerMetrics() {
    if ('getCircuitBreakerMetrics' in this.provider) {
      return (this.provider as any).getCircuitBreakerMetrics();
    }
    return null;
  }

  /**
   * Get circuit breaker states for all tools
   */
  getToolCircuitBreakerStates() {
    return this.toolRegistry.getCircuitBreakerStates();
  }

  /**
   * Get circuit breaker metrics for a specific tool
   */
  getToolCircuitBreakerMetrics(toolName: string) {
    return this.toolRegistry.getToolCircuitBreakerMetrics(toolName);
  }

  /**
   * Manually reset a tool's circuit breaker
   */
  resetToolCircuitBreaker(toolName: string): void {
    this.toolRegistry.resetToolCircuitBreaker(toolName);
    this.logger.info({ toolName }, 'Tool circuit breaker reset by user');
  }

  isRunning(): boolean {
    return this.agenticLoop.isRunning();
  }

  isPaused(): boolean {
    return this.agenticLoop.isPaused();
  }

  isCancelled(): boolean {
    return this.agenticLoop.isCancelled();
  }

  // ============ Cleanup ============

  onCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  destroy(): void {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;

    this.logger.debug('Agent destroy started');

    try {
      this.agenticLoop.cancel('Agent destroyed');
    } catch {
      // Ignore errors during cancel
    }

    // Remove event listeners
    for (const [eventName, handler] of this.boundListeners) {
      this.agenticLoop.off(eventName, handler);
    }
    this.boundListeners.clear();
    this.removeAllListeners();

    // Run cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        this.logger.error({ error: (error as Error).message }, 'Cleanup callback error');
      }
    }
    this.cleanupCallbacks = [];

    metrics.increment('agent.destroyed', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    this.logger.debug('Agent destroyed');
  }

  // ============ Private ============

  private setupEventForwarding(): void {
    const eventNames: Array<keyof AgenticLoopEvents> = [
      'execution:start',
      'execution:complete',
      'execution:error',
      'execution:paused',
      'execution:resumed',
      'execution:cancelled',
      'iteration:start',
      'iteration:complete',
      'llm:request',
      'llm:response',
      'llm:error',
      'tool:detected',
      'tool:start',
      'tool:complete',
      'tool:error',
      'tool:timeout',
      'hook:error',
    ];

    for (const eventName of eventNames) {
      const handler = (data: any) => {
        if (!this._isDestroyed) {
          this.emit(eventName, data);
        }
      };
      this.boundListeners.set(eventName, handler);
      this.agenticLoop.on(eventName, handler);
    }
  }
}
