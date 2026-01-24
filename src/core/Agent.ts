/**
 * Agent - AI assistant bound to a Connector
 *
 * This is the main public API for creating and using agents.
 * Replaces the old OneRingAI → AgentManager → Agent flow.
 */

import { EventEmitter } from 'eventemitter3';
import { Connector } from './Connector.js';
import { createProvider } from './createProvider.js';
import { ToolManager } from './ToolManager.js';
import { SessionManager, Session, ISessionStorage } from './SessionManager.js';
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
 * Session configuration for Agent
 */
export interface AgentSessionConfig {
  /** Storage backend for sessions */
  storage: ISessionStorage;
  /** Resume existing session by ID */
  id?: string;
  /** Auto-save session after each interaction */
  autoSave?: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs?: number;
}

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

  // === NEW: Optional session support ===
  /** Session configuration for persistence (opt-in) */
  session?: AgentSessionConfig;

  // === NEW: Advanced tool management ===
  /** Provide a pre-configured ToolManager (advanced) */
  toolManager?: ToolManager;
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

  // === NEW: Tool and Session Management ===
  private _toolManager: ToolManager;
  private _sessionManager: SessionManager | null = null;
  private _session: Session | null = null;
  private _pendingSessionLoad: Promise<void> | null = null;

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Advanced tool management. Returns ToolManager for fine-grained control.
   * For simple cases, use addTool/removeTool instead.
   */
  get tools(): ToolManager {
    return this._toolManager;
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
    if (agent._pendingSessionLoad) {
      await agent._pendingSessionLoad;
    }

    return agent;
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

    // === Create ToolManager ===
    this._toolManager = config.toolManager ?? new ToolManager();

    // Register tools from config (backward compatible)
    if (config.tools) {
      for (const tool of config.tools) {
        this._toolManager.register(tool);
      }
    }

    // Create tool registry (still needed for AgenticLoop compatibility)
    // ToolRegistry wraps the execution, ToolManager handles registration
    this.toolRegistry = new ToolRegistry();
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolRegistry.registerTool(tool);
      }
    }

    // Sync ToolManager events with ToolRegistry
    this._toolManager.on('tool:registered', ({ name }) => {
      const tool = this._toolManager.get(name);
      if (tool && !this.toolRegistry.hasToolFunction(name)) {
        this.toolRegistry.registerTool(tool);
      }
    });

    this._toolManager.on('tool:unregistered', ({ name }) => {
      if (this.toolRegistry.hasToolFunction(name)) {
        this.toolRegistry.unregisterTool(name);
      }
    });

    // Create agentic loop
    this.agenticLoop = new AgenticLoop(
      this.provider,
      this.toolRegistry,
      config.hooks,
      config.errorHandling
    );

    // Forward events from AgenticLoop
    this.setupEventForwarding();

    // === Setup Session (optional) ===
    if (config.session) {
      this._sessionManager = new SessionManager({ storage: config.session.storage });

      if (config.session.id) {
        // Resume existing session
        this._pendingSessionLoad = this.loadSessionInternal(config.session.id);
      } else {
        // Create new session
        this._session = this._sessionManager.create('agent', {
          title: this.name,
        });

        // Setup auto-save if configured
        if (config.session.autoSave) {
          const interval = config.session.autoSaveIntervalMs ?? 30000;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      }
    }
  }

  /**
   * Internal method to load session
   */
  private async loadSessionInternal(sessionId: string): Promise<void> {
    if (!this._sessionManager) return;

    try {
      const session = await this._sessionManager.load(sessionId);
      if (session) {
        this._session = session;

        // Restore tool state
        if (session.toolState) {
          this._toolManager.loadState(session.toolState);
        }

        this.logger.info({ sessionId }, 'Session loaded');

        // Setup auto-save if configured
        if (this.config.session?.autoSave) {
          const interval = this.config.session.autoSaveIntervalMs ?? 30000;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      } else {
        this.logger.warn({ sessionId }, 'Session not found, creating new session');
        this._session = this._sessionManager.create('agent', {
          title: this.name,
        });
      }
    } catch (error) {
      this.logger.error({ error: (error as Error).message, sessionId }, 'Failed to load session');
      throw error;
    }
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
      // Get enabled tools from ToolManager (respects enable/disable)
      const enabledTools = this._toolManager.getEnabled();
      const tools = enabledTools.map((t) => t.definition);

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
      // Get enabled tools from ToolManager (respects enable/disable)
      const enabledTools = this._toolManager.getEnabled();
      const tools = enabledTools.map((t) => t.definition);

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
    this._toolManager.register(tool);
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
    this._toolManager.unregister(toolName);
    this.toolRegistry.unregisterTool(toolName);
    if (this.config.tools) {
      this.config.tools = this.config.tools.filter(
        (t) => t.definition.function.name !== toolName
      );
    }
  }

  /**
   * List registered tools (returns enabled tool names)
   */
  listTools(): string[] {
    return this._toolManager.listEnabled();
  }

  /**
   * Replace all tools with a new array
   */
  setTools(tools: ToolFunction[]): void {
    // Clear existing tools
    for (const name of this._toolManager.list()) {
      this._toolManager.unregister(name);
      this.toolRegistry.unregisterTool(name);
    }
    // Register new tools
    for (const tool of tools) {
      this._toolManager.register(tool);
      this.toolRegistry.registerTool(tool);
    }
    this.config.tools = [...tools];
  }

  // ============ Session Management (NEW) ============

  /**
   * Get the current session ID (if session is enabled)
   */
  getSessionId(): string | null {
    return this._session?.id ?? null;
  }

  /**
   * Check if this agent has session support enabled
   */
  hasSession(): boolean {
    return this._session !== null;
  }

  /**
   * Save the current session to storage
   * @throws Error if session is not enabled
   */
  async saveSession(): Promise<void> {
    if (!this._sessionManager || !this._session) {
      throw new Error('Session not enabled. Configure session in AgentConfig to use this feature.');
    }

    // Update session state before saving
    this._session.toolState = this._toolManager.getState();

    await this._sessionManager.save(this._session);
    this.logger.debug({ sessionId: this._session.id }, 'Session saved');
  }

  /**
   * Get the current session (for advanced use)
   */
  getSession(): Session | null {
    return this._session;
  }

  /**
   * Update session custom data
   */
  updateSessionData(key: string, value: unknown): void {
    if (!this._session) {
      throw new Error('Session not enabled');
    }
    this._session.custom[key] = value;
  }

  /**
   * Get session custom data
   */
  getSessionData<T = unknown>(key: string): T | undefined {
    return this._session?.custom[key] as T | undefined;
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

    // Cleanup session manager
    if (this._sessionManager) {
      if (this._session) {
        this._sessionManager.stopAutoSave(this._session.id);
      }
      this._sessionManager.destroy();
    }

    // Cleanup tool manager listeners
    this._toolManager.removeAllListeners();

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
