/**
 * BaseAgent - Abstract base class for all agent types
 *
 * Provides shared functionality for:
 * - Connector resolution
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 *
 * This is an INTERNAL class - not exported in the public API.
 * Use Agent, TaskAgent, or UniversalAgent instead.
 */

import { EventEmitter } from 'eventemitter3';
import { Connector } from './Connector.js';
import { ToolManager } from './ToolManager.js';
import { SessionManager, Session, ISessionStorage, SerializedPlan, SerializedMemory } from './SessionManager.js';
import { ToolPermissionManager } from './permissions/ToolPermissionManager.js';
import type { AgentPermissionsConfig, SerializedApprovalState } from './permissions/types.js';
import type { ToolFunction } from '../domain/entities/Tool.js';
import type { SerializedToolState } from './ToolManager.js';
import { logger, FrameworkLogger } from '../infrastructure/observability/Logger.js';

/**
 * Options for tool registration
 */
export interface ToolRegistrationOptions {
  /** Namespace for the tool (e.g., 'user', '_meta', 'mcp:fs') */
  namespace?: string;
  /** Whether the tool is enabled by default */
  enabled?: boolean;
}

/**
 * Base session configuration (shared by all agent types)
 */
export interface BaseSessionConfig {
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
 * Tool execution context passed to lifecycle hooks
 */
export interface ToolExecutionHookContext {
  /** Name of the tool being executed */
  toolName: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Agent ID */
  agentId: string;
  /** Task ID (if running in TaskAgent) */
  taskId?: string;
}

/**
 * Tool execution result passed to afterToolExecution hook
 */
export interface ToolExecutionResult {
  /** Name of the tool that was executed */
  toolName: string;
  /** Result returned by the tool */
  result: unknown;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Whether the execution was successful */
  success: boolean;
  /** Error if execution failed */
  error?: Error;
}

/**
 * Agent lifecycle hooks for customization.
 * These hooks allow external code to observe and modify agent behavior
 * at key points in the execution lifecycle.
 */
export interface AgentLifecycleHooks {
  /**
   * Called before a tool is executed.
   * Can be used for logging, validation, or rate limiting.
   * Throw an error to prevent tool execution.
   *
   * @param context - Tool execution context
   * @returns Promise that resolves when hook completes
   */
  beforeToolExecution?: (context: ToolExecutionHookContext) => Promise<void>;

  /**
   * Called after a tool execution completes (success or failure).
   * Can be used for logging, metrics, or cleanup.
   *
   * @param result - Tool execution result
   * @returns Promise that resolves when hook completes
   */
  afterToolExecution?: (result: ToolExecutionResult) => Promise<void>;

  /**
   * Called before context is prepared for LLM call.
   * Can be used to inject additional context or modify components.
   *
   * @param agentId - Agent identifier
   * @returns Promise that resolves when hook completes
   */
  beforeContextPrepare?: (agentId: string) => Promise<void>;

  /**
   * Called after context compaction occurs.
   * Can be used for logging or monitoring context management.
   *
   * @param log - Compaction log messages
   * @param tokensFreed - Number of tokens freed
   * @returns Promise that resolves when hook completes
   */
  afterCompaction?: (log: string[], tokensFreed: number) => Promise<void>;

  /**
   * Called when agent encounters an error.
   * Can be used for custom error handling or recovery logic.
   *
   * @param error - The error that occurred
   * @param context - Additional context about where the error occurred
   * @returns Promise that resolves when hook completes
   */
  onError?: (error: Error, context: { phase: string; agentId: string }) => Promise<void>;
}

/**
 * Base configuration shared by all agent types
 */
export interface BaseAgentConfig {
  /** Connector name or instance */
  connector: string | Connector;

  /** Model identifier */
  model: string;

  /** Agent name (optional, auto-generated if not provided) */
  name?: string;

  /** Tools available to the agent */
  tools?: ToolFunction[];

  /** Provide a pre-configured ToolManager (advanced) */
  toolManager?: ToolManager;

  /** Session configuration */
  session?: BaseSessionConfig;

  /** Permission configuration */
  permissions?: AgentPermissionsConfig;

  /** Lifecycle hooks for customization */
  lifecycleHooks?: AgentLifecycleHooks;
}

/**
 * Base events emitted by all agent types.
 * Agent subclasses typically extend their own event interfaces.
 */
export interface BaseAgentEvents {
  'session:saved': { sessionId: string };
  'session:loaded': { sessionId: string };
  destroyed: void;
}

/**
 * Abstract base class for all agent types.
 *
 * @internal This class is not exported in the public API.
 *
 * Note: TEvents is not constrained to BaseAgentEvents to allow subclasses
 * to define their own event interfaces (e.g., AgenticLoopEvents for Agent).
 */
export abstract class BaseAgent<
  TConfig extends BaseAgentConfig = BaseAgentConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TEvents extends Record<string, any> = BaseAgentEvents,
> extends EventEmitter<TEvents> {
  // ===== Core Properties =====
  readonly name: string;
  readonly connector: Connector;
  readonly model: string;

  // ===== Protected State =====
  protected _config: TConfig;
  protected _toolManager: ToolManager;
  protected _permissionManager: ToolPermissionManager;
  protected _sessionManager: SessionManager | null = null;
  protected _session: Session | null = null;
  protected _pendingSessionLoad: Promise<void> | null = null;
  protected _isDestroyed = false;
  protected _cleanupCallbacks: Array<() => void | Promise<void>> = [];
  protected _logger: FrameworkLogger;
  protected _lifecycleHooks: AgentLifecycleHooks;

  // ===== Constructor =====

  constructor(config: TConfig, loggerComponent: string) {
    super();
    this._config = config;

    // Resolve connector
    this.connector = this.resolveConnector(config.connector);

    // Set name
    this.name = config.name ?? `${this.getAgentType()}-${Date.now()}`;
    this.model = config.model;

    // Create logger
    this._logger = logger.child({
      component: loggerComponent,
      agentName: this.name,
      model: this.model,
      connector: this.connector.name,
    });

    // Initialize tool manager
    this._toolManager = this.initializeToolManager(config.toolManager, config.tools);

    // Initialize permission manager
    this._permissionManager = this.initializePermissionManager(config.permissions, config.tools);

    // Initialize lifecycle hooks
    this._lifecycleHooks = config.lifecycleHooks ?? {};
  }

  // ===== Abstract Methods =====

  /**
   * Get the agent type identifier for session serialization
   */
  protected abstract getAgentType(): 'agent' | 'task-agent' | 'universal-agent';

  /**
   * Prepare session state before saving.
   * Subclasses override to add their specific state (plan, memory, etc.)
   *
   * Default implementation does nothing - override in subclasses.
   */
  protected prepareSessionState(): void {
    // Default: no additional state to prepare
    // Subclasses override to add plan, memory, mode, etc.
  }

  /**
   * Restore session state after loading.
   * Subclasses override to restore their specific state (plan, memory, etc.)
   * Called after tool state and approval state are restored.
   *
   * Default implementation does nothing - override in subclasses.
   */
  protected async restoreSessionState(_session: Session): Promise<void> {
    // Default: no additional state to restore
    // Subclasses override to restore plan, memory, mode, etc.
  }

  /**
   * Get plan state for session serialization.
   * Subclasses with plans override this.
   */
  protected getSerializedPlan(): SerializedPlan | undefined {
    return undefined;
  }

  /**
   * Get memory state for session serialization.
   * Subclasses with working memory override this.
   */
  protected getSerializedMemory(): SerializedMemory | undefined {
    return undefined;
  }

  // ===== Protected Initialization Helpers =====

  /**
   * Resolve connector from string name or instance
   */
  protected resolveConnector(ref: string | Connector): Connector {
    if (typeof ref === 'string') {
      return Connector.get(ref);
    }
    return ref;
  }

  /**
   * Initialize tool manager with provided tools
   */
  protected initializeToolManager(
    existingManager?: ToolManager,
    tools?: ToolFunction[],
    options?: ToolRegistrationOptions
  ): ToolManager {
    const manager = existingManager ?? new ToolManager();

    if (tools) {
      this.registerTools(manager, tools, options);
    }

    return manager;
  }

  /**
   * Register multiple tools with the tool manager
   * Utility method to avoid code duplication across agent types
   */
  protected registerTools(
    manager: ToolManager,
    tools: ToolFunction[],
    options?: ToolRegistrationOptions
  ): void {
    for (const tool of tools) {
      manager.register(tool, options);
    }
  }

  /**
   * Initialize permission manager
   */
  protected initializePermissionManager(
    config?: AgentPermissionsConfig,
    tools?: ToolFunction[]
  ): ToolPermissionManager {
    const manager = new ToolPermissionManager(config);

    // Register tool permission configs
    if (tools) {
      for (const tool of tools) {
        if (tool.permission) {
          manager.setToolConfig(tool.definition.function.name, tool.permission);
        }
      }
    }

    return manager;
  }

  /**
   * Initialize session management (call from subclass constructor after other setup)
   */
  protected initializeSession(sessionConfig?: BaseSessionConfig): void {
    if (!sessionConfig) {
      return;
    }

    this._sessionManager = new SessionManager({ storage: sessionConfig.storage });

    if (sessionConfig.id) {
      // Resume existing session (async)
      this._pendingSessionLoad = this.loadSessionInternal(sessionConfig.id);
    } else {
      // Create new session
      this._session = this._sessionManager.create(this.getAgentType(), {
        title: this.name,
      });

      // Setup auto-save if configured
      if (sessionConfig.autoSave) {
        const interval = sessionConfig.autoSaveIntervalMs ?? 30000;
        this._sessionManager.enableAutoSave(this._session, interval);
      }
    }
  }

  /**
   * Ensure any pending session load is complete
   */
  protected async ensureSessionLoaded(): Promise<void> {
    if (this._pendingSessionLoad) {
      await this._pendingSessionLoad;
      this._pendingSessionLoad = null;
    }
  }

  /**
   * Internal method to load session
   */
  protected async loadSessionInternal(sessionId: string): Promise<void> {
    if (!this._sessionManager) return;

    try {
      const session = await this._sessionManager.load(sessionId);
      if (session) {
        this._session = session;

        // Restore tool state
        if (session.toolState) {
          this._toolManager.loadState(session.toolState as SerializedToolState);
        }

        // Restore approval state (if permission inheritance is enabled)
        const inheritFromSession = this._config.permissions?.inheritFromSession !== false;
        if (inheritFromSession && session.custom['approvalState']) {
          this._permissionManager.loadState(
            session.custom['approvalState'] as SerializedApprovalState
          );
        }

        // Let subclass restore its specific state (plan, memory, mode, etc.)
        await this.restoreSessionState(session);

        this._logger.info({ sessionId }, 'Session loaded');

        // Setup auto-save if configured
        if (this._config.session?.autoSave) {
          const interval = this._config.session.autoSaveIntervalMs ?? 30000;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      } else {
        this._logger.warn({ sessionId }, 'Session not found, creating new session');
        this._session = this._sessionManager.create(this.getAgentType(), {
          title: this.name,
        });
      }
    } catch (error) {
      this._logger.error(
        { error: (error as Error).message, sessionId },
        'Failed to load session'
      );
      throw error;
    }
  }

  // ===== Public Session API =====

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
   * Get the current session (for advanced use)
   */
  getSession(): Session | null {
    return this._session;
  }

  /**
   * Save the current session to storage
   * @throws Error if session is not enabled
   */
  async saveSession(): Promise<void> {
    // Ensure any pending session load is complete
    await this.ensureSessionLoaded();

    if (!this._sessionManager || !this._session) {
      throw new Error(
        'Session not enabled. Configure session in agent config to use this feature.'
      );
    }

    // Update common session state
    this._session.toolState = this._toolManager.getState();
    this._session.custom['approvalState'] = this._permissionManager.getState();

    // Get plan and memory state from subclass hooks
    const plan = this.getSerializedPlan();
    if (plan) {
      this._session.plan = plan;
    }

    const memory = this.getSerializedMemory();
    if (memory) {
      this._session.memory = memory;
    }

    // Let subclass add any additional specific state
    this.prepareSessionState();

    await this._sessionManager.save(this._session);
    this._logger.debug({ sessionId: this._session.id }, 'Session saved');
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

  // ===== Public Permission API =====

  /**
   * Advanced tool management. Returns ToolManager for fine-grained control.
   */
  get tools(): ToolManager {
    return this._toolManager;
  }

  /**
   * Permission management. Returns ToolPermissionManager for approval control.
   */
  get permissions(): ToolPermissionManager {
    return this._permissionManager;
  }

  // ===== Tool Management =====

  /**
   * Add a tool to the agent
   */
  addTool(tool: ToolFunction): void {
    this._toolManager.register(tool);
    if (!this._config.tools) {
      this._config.tools = [];
    }
    this._config.tools.push(tool);

    // Sync permission config if tool has one
    if (tool.permission) {
      this._permissionManager.setToolConfig(tool.definition.function.name, tool.permission);
    }
  }

  /**
   * Remove a tool from the agent
   */
  removeTool(toolName: string): void {
    this._toolManager.unregister(toolName);
    if (this._config.tools) {
      this._config.tools = this._config.tools.filter(
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
    this._toolManager.clear();
    for (const tool of tools) {
      this._toolManager.register(tool);
      if (tool.permission) {
        this._permissionManager.setToolConfig(tool.definition.function.name, tool.permission);
      }
    }
    this._config.tools = [...tools];
  }

  /**
   * Get enabled tool definitions (for passing to LLM).
   * This is a helper that extracts definitions from enabled tools.
   */
  protected getEnabledToolDefinitions(): import('../domain/entities/Tool.js').FunctionToolDefinition[] {
    return this._toolManager.getEnabled().map((t) => t.definition);
  }

  // ===== Lifecycle Hooks =====

  /**
   * Get the current lifecycle hooks configuration
   */
  get lifecycleHooks(): AgentLifecycleHooks {
    return this._lifecycleHooks;
  }

  /**
   * Set or update lifecycle hooks at runtime
   */
  setLifecycleHooks(hooks: Partial<AgentLifecycleHooks>): void {
    this._lifecycleHooks = { ...this._lifecycleHooks, ...hooks };
  }

  /**
   * Invoke beforeToolExecution hook if defined.
   * Call this before executing a tool.
   *
   * @throws Error if hook throws (prevents tool execution)
   */
  protected async invokeBeforeToolExecution(context: ToolExecutionHookContext): Promise<void> {
    if (this._lifecycleHooks.beforeToolExecution) {
      try {
        await this._lifecycleHooks.beforeToolExecution(context);
      } catch (error) {
        this._logger.error(
          { error: (error as Error).message, toolName: context.toolName },
          'beforeToolExecution hook failed'
        );
        throw error; // Re-throw to prevent tool execution
      }
    }
  }

  /**
   * Invoke afterToolExecution hook if defined.
   * Call this after tool execution completes (success or failure).
   */
  protected async invokeAfterToolExecution(result: ToolExecutionResult): Promise<void> {
    if (this._lifecycleHooks.afterToolExecution) {
      try {
        await this._lifecycleHooks.afterToolExecution(result);
      } catch (error) {
        this._logger.error(
          { error: (error as Error).message, toolName: result.toolName },
          'afterToolExecution hook failed'
        );
        // Don't re-throw - hook failure shouldn't affect main flow after execution
      }
    }
  }

  /**
   * Invoke beforeContextPrepare hook if defined.
   * Call this before preparing context for LLM.
   */
  protected async invokeBeforeContextPrepare(): Promise<void> {
    if (this._lifecycleHooks.beforeContextPrepare) {
      try {
        await this._lifecycleHooks.beforeContextPrepare(this.name);
      } catch (error) {
        this._logger.error(
          { error: (error as Error).message },
          'beforeContextPrepare hook failed'
        );
        // Don't re-throw - allow context preparation to continue
      }
    }
  }

  /**
   * Invoke afterCompaction hook if defined.
   * Call this after context compaction occurs.
   */
  protected async invokeAfterCompaction(log: string[], tokensFreed: number): Promise<void> {
    if (this._lifecycleHooks.afterCompaction) {
      try {
        await this._lifecycleHooks.afterCompaction(log, tokensFreed);
      } catch (error) {
        this._logger.error(
          { error: (error as Error).message, tokensFreed },
          'afterCompaction hook failed'
        );
        // Don't re-throw - allow execution to continue
      }
    }
  }

  /**
   * Invoke onError hook if defined.
   * Call this when the agent encounters an error.
   */
  protected async invokeOnError(error: Error, phase: string): Promise<void> {
    if (this._lifecycleHooks.onError) {
      try {
        await this._lifecycleHooks.onError(error, { phase, agentId: this.name });
      } catch (hookError) {
        this._logger.error(
          { error: (hookError as Error).message, originalError: error.message, phase },
          'onError hook failed'
        );
        // Don't re-throw - hook failure shouldn't mask original error
      }
    }
  }

  // ===== Lifecycle =====

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Register a cleanup callback
   */
  onCleanup(callback: () => void | Promise<void>): void {
    this._cleanupCallbacks.push(callback);
  }

  /**
   * Base cleanup for session and listeners.
   * Subclasses should call super.baseDestroy() in their destroy() method.
   */
  protected baseDestroy(): void {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;

    this._logger.debug('Agent destroy started');

    // Cleanup session manager
    if (this._sessionManager) {
      if (this._session) {
        this._sessionManager.stopAutoSave(this._session.id);
      }
      this._sessionManager.destroy();
    }

    // Cleanup tool manager listeners
    this._toolManager.removeAllListeners();

    // Cleanup permission manager listeners
    this._permissionManager.removeAllListeners();

    // Remove all event listeners
    this.removeAllListeners();

    // Emit destroyed event (before removing listeners)
    // Note: This won't be received since we removed listeners above
    // but subclasses can emit before calling baseDestroy if needed
  }

  /**
   * Run cleanup callbacks
   */
  protected async runCleanupCallbacks(): Promise<void> {
    for (const callback of this._cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        this._logger.error({ error: (error as Error).message }, 'Cleanup callback error');
      }
    }
    this._cleanupCallbacks = [];
  }
}
