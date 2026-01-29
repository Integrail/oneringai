/**
 * Agent - AI assistant bound to a Connector
 *
 * This is the main public API for creating and using agents.
 * Extends BaseAgent for shared functionality.
 */

import { BaseAgent, BaseAgentConfig, BaseSessionConfig } from './BaseAgent.js';
import { createProvider } from './createProvider.js';
import { AgenticLoop, AgenticLoopConfig } from '../capabilities/agents/AgenticLoop.js';
import { ExecutionContext, HistoryMode } from '../capabilities/agents/ExecutionContext.js';
import { InputItem } from '../domain/entities/Message.js';
import { AgentResponse } from '../domain/entities/Response.js';
import { StreamEvent } from '../domain/entities/StreamEvent.js';
import { HookConfig } from '../capabilities/agents/types/HookTypes.js';
import { AgenticLoopEvents } from '../capabilities/agents/types/EventTypes.js';
import { IDisposable, assertNotDestroyed } from '../domain/interfaces/IDisposable.js';
import { ITextProvider } from '../domain/interfaces/ITextProvider.js';
import { ISessionStorage } from './SessionManager.js';
import { metrics } from '../infrastructure/observability/Metrics.js';

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
  vendorOptions?: Record<string, any>;

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
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 */
export class Agent extends BaseAgent<AgentConfig, AgenticLoopEvents> implements IDisposable {
  // ===== Agent-specific State =====
  private provider: ITextProvider;
  private agenticLoop: AgenticLoop;
  private boundListeners: Map<keyof AgenticLoopEvents, (...args: any[]) => void> = new Map();

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
    config: Omit<AgentConfig, 'session'> & { session: { storage: ISessionStorage } }
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

  // ===== Constructor =====

  private constructor(config: AgentConfig) {
    super(config, 'Agent');

    this._logger.debug({ config }, 'Agent created');
    metrics.increment('agent.created', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    // Create provider from connector
    this.provider = createProvider(this.connector);

    // Sync tool permission configs from ToolManager to PermissionManager
    this._toolManager.on('tool:registered', ({ name }) => {
      const permission = this._toolManager.getPermission(name);
      if (permission) {
        this._permissionManager.setToolConfig(name, permission);
      }
    });

    // Create agentic loop - ToolManager implements IToolExecutor
    this.agenticLoop = new AgenticLoop(
      this.provider,
      this._toolManager,
      config.hooks,
      config.errorHandling
    );

    // Forward events from AgenticLoop
    this.setupEventForwarding();

    // Initialize session (from BaseAgent)
    this.initializeSession(config.session);
  }

  // ===== Abstract Method Implementations =====

  protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent' {
    return 'agent';
  }

  protected prepareSessionState(): void {
    // Agent has no additional state beyond what BaseAgent handles
    // (tool state and approval state are handled by BaseAgent)
  }

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

    this._logger.info({
      inputPreview,
      toolCount: this._config.tools?.length || 0,
    }, 'Agent run started');

    metrics.increment('agent.run.started', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    const startTime = Date.now();

    try {
      // Get enabled tool definitions (respects enable/disable)
      const tools = this.getEnabledToolDefinitions();

      const loopConfig: AgenticLoopConfig = {
        model: this.model,
        input,
        instructions: this._config.instructions,
        tools,
        temperature: this._config.temperature,
        maxIterations: this._config.maxIterations || 10,
        vendorOptions: this._config.vendorOptions,
        hooks: this._config.hooks,
        historyMode: this._config.historyMode,
        limits: this._config.limits,
        errorHandling: this._config.errorHandling,
        permissionManager: this._permissionManager,
        agentType: 'agent',
      };

      const response = await this.agenticLoop.execute(loopConfig);

      const duration = Date.now() - startTime;

      this._logger.info({ duration }, 'Agent run completed');

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

      this._logger.error({
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

    // Ensure any pending session load is complete
    await this.ensureSessionLoaded();

    const inputPreview = typeof input === 'string'
      ? input.substring(0, 100)
      : `${input.length} messages`;

    this._logger.info({
      inputPreview,
      toolCount: this._config.tools?.length || 0,
    }, 'Agent stream started');

    metrics.increment('agent.stream.started', 1, {
      model: this.model,
      connector: this.connector.name,
    });

    const startTime = Date.now();

    try {
      // Get enabled tool definitions (respects enable/disable)
      const tools = this.getEnabledToolDefinitions();

      const loopConfig: AgenticLoopConfig = {
        model: this.model,
        input,
        instructions: this._config.instructions,
        tools,
        temperature: this._config.temperature,
        maxIterations: this._config.maxIterations || 10,
        vendorOptions: this._config.vendorOptions,
        hooks: this._config.hooks,
        historyMode: this._config.historyMode,
        limits: this._config.limits,
        errorHandling: this._config.errorHandling,
        permissionManager: this._permissionManager,
        agentType: 'agent',
      };

      yield* this.agenticLoop.executeStreaming(loopConfig);

      const duration = Date.now() - startTime;

      this._logger.info({ duration }, 'Agent stream completed');

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

      this._logger.error({
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

  // ===== Tool Management =====
  // Note: addTool, removeTool, listTools, setTools are inherited from BaseAgent

  // ===== Permission Convenience Methods =====

  /**
   * Approve a tool for the current session.
   */
  approveToolForSession(toolName: string): void {
    this._permissionManager.approveForSession(toolName);
  }

  /**
   * Revoke a tool's session approval.
   */
  revokeToolApproval(toolName: string): void {
    this._permissionManager.revoke(toolName);
  }

  /**
   * Get list of tools that have been approved for this session.
   */
  getApprovedTools(): string[] {
    return this._permissionManager.getApprovedTools();
  }

  /**
   * Check if a tool needs approval before execution.
   */
  toolNeedsApproval(toolName: string): boolean {
    return this._permissionManager.checkPermission(toolName).needsApproval;
  }

  /**
   * Check if a tool is blocked (cannot execute at all).
   */
  toolIsBlocked(toolName: string): boolean {
    return this._permissionManager.isBlocked(toolName);
  }

  /**
   * Add a tool to the allowlist (always allowed, no approval needed).
   */
  allowlistTool(toolName: string): void {
    this._permissionManager.allowlistAdd(toolName);
  }

  /**
   * Add a tool to the blocklist (always blocked, cannot execute).
   */
  blocklistTool(toolName: string): void {
    this._permissionManager.blocklistAdd(toolName);
  }

  // ===== Configuration Methods =====

  /**
   * Change the model
   */
  setModel(model: string): void {
    (this as { model: string }).model = model;
    this._config.model = model;
  }

  /**
   * Get current temperature
   */
  getTemperature(): number | undefined {
    return this._config.temperature;
  }

  /**
   * Change the temperature
   */
  setTemperature(temperature: number): void {
    this._config.temperature = temperature;
  }

  // ===== Control Methods =====

  pause(reason?: string): void {
    this.agenticLoop.pause(reason);
  }

  resume(): void {
    this.agenticLoop.resume();
  }

  cancel(reason?: string): void {
    this.agenticLoop.cancel(reason);
  }

  // ===== Introspection =====

  getContext(): ExecutionContext | null {
    return this.agenticLoop.getContext();
  }

  getMetrics() {
    return this.agenticLoop.getContext()?.metrics || null;
  }

  getSummary() {
    return this.agenticLoop.getContext()?.getSummary() || null;
  }

  getAuditTrail() {
    return this.agenticLoop.getContext()?.getAuditTrail() || [];
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
    return this._toolManager.getCircuitBreakerStates();
  }

  /**
   * Get circuit breaker metrics for a specific tool
   */
  getToolCircuitBreakerMetrics(toolName: string) {
    return this._toolManager.getToolCircuitBreakerMetrics(toolName);
  }

  /**
   * Manually reset a tool's circuit breaker
   */
  resetToolCircuitBreaker(toolName: string): void {
    this._toolManager.resetToolCircuitBreaker(toolName);
    this._logger.info({ toolName }, 'Tool circuit breaker reset by user');
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

  // ===== Cleanup =====

  destroy(): void {
    if (this._isDestroyed) {
      return;
    }

    this._logger.debug('Agent destroy started');

    // Cancel any ongoing execution
    try {
      this.agenticLoop.cancel('Agent destroyed');
    } catch {
      // Ignore errors during cancel
    }

    // Remove event listeners from AgenticLoop
    for (const [eventName, handler] of this.boundListeners) {
      this.agenticLoop.off(eventName, handler);
    }
    this.boundListeners.clear();

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

  // ===== Private =====

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

    const registered: Array<[keyof AgenticLoopEvents, (...args: any[]) => void]> = [];

    try {
      for (const eventName of eventNames) {
        const handler = (data: any) => {
          if (!this._isDestroyed) {
            this.emit(eventName, data);
          }
        };
        this.agenticLoop.on(eventName, handler);
        registered.push([eventName, handler]);
        this.boundListeners.set(eventName, handler);
      }
    } catch (error) {
      // Cleanup any registered listeners on failure
      for (const [eventName, handler] of registered) {
        this.agenticLoop.off(eventName, handler);
      }
      throw error;
    }
  }
}
