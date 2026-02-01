/**
 * BaseAgent - Abstract base class for all agent types
 *
 * Provides shared functionality for:
 * - Connector resolution
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management (via AgentContext)
 * - Lifecycle/cleanup
 *
 * This is an INTERNAL class - not exported in the public API.
 * Use Agent, TaskAgent, or UniversalAgent instead.
 */

import { EventEmitter } from 'eventemitter3';
import { Connector } from './Connector.js';
import { ToolManager } from './ToolManager.js';
import { ToolPermissionManager } from './permissions/ToolPermissionManager.js';
import type { AgentPermissionsConfig } from './permissions/types.js';
import type { ToolFunction } from '../domain/entities/Tool.js';
import { logger, FrameworkLogger } from '../infrastructure/observability/Logger.js';
import { AgentContext } from './AgentContext.js';
import type { AgentContextConfig } from './AgentContext.js';
import { createProvider } from './createProvider.js';
import type { ITextProvider } from '../domain/interfaces/ITextProvider.js';
import type { LLMResponse } from '../domain/entities/Response.js';
import type { InputItem } from '../domain/entities/Message.js';
import type { StreamEvent } from '../domain/entities/StreamEvent.js';
import type { IContextStorage, ContextSessionMetadata } from '../domain/interfaces/IContextStorage.js';

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
 * Session configuration using AgentContext persistence
 */
export interface BaseSessionConfig {
  /** Storage backend for context sessions */
  storage: IContextStorage;
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
 * Context passed to beforeCompaction hook
 */
export interface BeforeCompactionContext {
  /** Agent identifier */
  agentId: string;
  /** Current context budget info */
  currentBudget: {
    total: number;
    used: number;
    available: number;
    utilizationPercent: number;
    status: 'ok' | 'warning' | 'critical';
  };
  /** Compaction strategy being used */
  strategy: string;
  /** Current context components (read-only) */
  components: ReadonlyArray<{
    name: string;
    priority: number;
    compactable: boolean;
  }>;
  /** Estimated tokens to be freed */
  estimatedTokensToFree: number;
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
   * Called before context compaction occurs.
   * Use this hook to save important data to working memory before it's compacted.
   * This is your last chance to preserve critical information from tool outputs
   * or conversation history that would otherwise be lost.
   *
   * @param context - Compaction context with budget info and components
   * @returns Promise that resolves when hook completes
   */
  beforeCompaction?: (context: BeforeCompactionContext) => Promise<void>;

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

  /** Session configuration (uses AgentContext persistence) */
  session?: BaseSessionConfig;

  /** Permission configuration */
  permissions?: AgentPermissionsConfig;

  /** Lifecycle hooks for customization */
  lifecycleHooks?: AgentLifecycleHooks;

  /**
   * Optional AgentContext configuration.
   * If provided as AgentContext instance, it will be used directly.
   * If provided as config object, a new AgentContext will be created.
   * If not provided, a default AgentContext will be created.
   */
  context?: AgentContext | AgentContextConfig;
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
 * Options for direct LLM calls (bypassing AgentContext).
 */
export interface DirectCallOptions {
  /** System instructions (optional) */
  instructions?: string;

  /** Include registered tools in the call. Default: false */
  includeTools?: boolean;

  /** Temperature for generation */
  temperature?: number;

  /** Maximum output tokens */
  maxOutputTokens?: number;

  /** Response format (text, json_object, json_schema) */
  responseFormat?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: unknown;
  };

  /** Vendor-specific options */
  vendorOptions?: Record<string, unknown>;
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
  protected _agentContext: AgentContext;  // SINGLE SOURCE OF TRUTH for tools and sessions
  protected _permissionManager: ToolPermissionManager;
  protected _isDestroyed = false;
  protected _cleanupCallbacks: Array<() => void | Promise<void>> = [];
  protected _logger: FrameworkLogger;
  protected _lifecycleHooks: AgentLifecycleHooks;

  // Session state
  protected _sessionConfig: BaseSessionConfig | null = null;
  protected _autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  protected _pendingSessionLoad: Promise<boolean> | null = null;

  // Lazy-initialized provider for direct calls
  private _directProvider: ITextProvider | null = null;

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

    // Initialize AgentContext FIRST (single source of truth for tools and sessions)
    this._agentContext = this.initializeAgentContext(config);

    // Register tools with AgentContext if provided
    if (config.tools) {
      for (const tool of config.tools) {
        this._agentContext.tools.register(tool);
      }
    }

    // Initialize permission manager (uses tools from AgentContext)
    this._permissionManager = this.initializePermissionManager(config.permissions, config.tools);

    // Initialize lifecycle hooks
    this._lifecycleHooks = config.lifecycleHooks ?? {};
  }

  // ===== Abstract Methods =====

  /**
   * Get the agent type identifier
   */
  protected abstract getAgentType(): 'agent' | 'task-agent' | 'universal-agent';

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
   * Initialize AgentContext (single source of truth for tools and sessions).
   * If AgentContext is provided, use it directly.
   * Otherwise, create a new one with the provided configuration.
   */
  protected initializeAgentContext(config: TConfig): AgentContext {
    // If AgentContext instance is provided, use it directly
    if (config.context instanceof AgentContext) {
      return config.context;
    }

    // Create new AgentContext with merged config
    // NOTE: Don't pass tools here - they're registered separately after creation
    // to allow subclasses to wrap or modify tools before registration
    const contextConfig: AgentContextConfig = {
      model: config.model,
      agentId: config.name,
      // Include storage and sessionId if session config is provided
      storage: config.session?.storage,
      sessionId: config.session?.id,
      // Subclasses can add systemPrompt via their config
      ...(typeof config.context === 'object' && config.context !== null ? config.context : {}),
    };

    return AgentContext.create(contextConfig);
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
   * Now uses AgentContext.save()/load() for persistence.
   */
  protected initializeSession(sessionConfig?: BaseSessionConfig): void {
    if (!sessionConfig) {
      return;
    }

    this._sessionConfig = sessionConfig;

    if (sessionConfig.id) {
      // Resume existing session (async)
      this._pendingSessionLoad = this.loadSession(sessionConfig.id);
    }

    // Setup auto-save if configured
    if (sessionConfig.autoSave) {
      const interval = sessionConfig.autoSaveIntervalMs ?? 30000;
      this._autoSaveInterval = setInterval(async () => {
        try {
          if (this._agentContext.sessionId) {
            await this._agentContext.save();
            this._logger.debug({ sessionId: this._agentContext.sessionId }, 'Auto-saved session');
          }
        } catch (error) {
          this._logger.error({ error: (error as Error).message }, 'Auto-save failed');
        }
      }, interval);
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

  // ===== Public Session API =====

  /**
   * Get the current session ID (if session is enabled)
   * Delegates to AgentContext.
   */
  getSessionId(): string | null {
    return this._agentContext.sessionId;
  }

  /**
   * Check if this agent has session support enabled
   */
  hasSession(): boolean {
    return this._agentContext.storage !== null;
  }

  /**
   * Save the current session to storage.
   * Uses getContextState() to get state, allowing subclasses to inject agent-level state.
   *
   * @param sessionId - Optional session ID (uses current or generates new)
   * @param metadata - Optional session metadata
   * @throws Error if storage is not configured
   */
  async saveSession(sessionId?: string, metadata?: ContextSessionMetadata): Promise<void> {
    await this.ensureSessionLoaded();
    // Get state via overridable method (allows agents to inject agentState)
    const state = await this.getContextState();
    await this._agentContext.save(sessionId, metadata, state);
    this._logger.debug({ sessionId: this._agentContext.sessionId }, 'Session saved');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.emit as any)('session:saved', { sessionId: this._agentContext.sessionId });
  }

  /**
   * Load a session from storage.
   * Uses restoreContextState() to restore state, allowing subclasses to restore agent-level state.
   *
   * @param sessionId - Session ID to load
   * @returns true if session was found and loaded, false if not found
   * @throws Error if storage is not configured
   */
  async loadSession(sessionId: string): Promise<boolean> {
    // Load raw state (doesn't restore yet)
    const result = await this._agentContext.loadRaw(sessionId);
    if (!result) {
      this._logger.warn({ sessionId }, 'Session not found');
      return false;
    }
    // Restore via overridable method (allows agents to restore agentState)
    await this.restoreContextState(result.state);
    this._logger.info({ sessionId }, 'Session loaded');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.emit as any)('session:loaded', { sessionId });
    return true;
  }

  /**
   * Check if a session exists in storage.
   * Delegates to AgentContext.sessionExists().
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    return this._agentContext.sessionExists(sessionId);
  }

  /**
   * Delete a session from storage.
   * Delegates to AgentContext.deleteSession().
   */
  async deleteSession(sessionId?: string): Promise<void> {
    await this._agentContext.deleteSession(sessionId);
    this._logger.debug({ sessionId }, 'Session deleted');
  }

  /**
   * Get context state for session persistence.
   * Override in subclasses to include agent-specific state in agentState field.
   */
  async getContextState(): Promise<import('./AgentContext.js').SerializedAgentContextState> {
    return this._agentContext.getState();
  }

  /**
   * Restore context from saved state.
   * Override in subclasses to restore agent-specific state from agentState field.
   */
  async restoreContextState(state: import('./AgentContext.js').SerializedAgentContextState): Promise<void> {
    await this._agentContext.restoreState(state);
  }

  // ===== Public Permission API =====

  /**
   * Advanced tool management. Returns ToolManager for fine-grained control.
   * This is delegated to AgentContext.tools (single source of truth).
   */
  get tools(): ToolManager {
    return this._agentContext.tools;
  }

  /**
   * Get the AgentContext (unified context management).
   * This is the primary way to access tools, memory, cache, permissions, and history.
   */
  get context(): AgentContext {
    return this._agentContext;
  }

  /**
   * Permission management. Returns ToolPermissionManager for approval control.
   */
  get permissions(): ToolPermissionManager {
    return this._permissionManager;
  }

  // ===== Tool Management =====

  /**
   * Add a tool to the agent.
   * Tools are registered with AgentContext (single source of truth).
   */
  addTool(tool: ToolFunction): void {
    this._agentContext.tools.register(tool);

    // Sync permission config if tool has one
    if (tool.permission) {
      this._permissionManager.setToolConfig(tool.definition.function.name, tool.permission);
    }
  }

  /**
   * Remove a tool from the agent.
   * Tools are unregistered from AgentContext (single source of truth).
   */
  removeTool(toolName: string): void {
    this._agentContext.tools.unregister(toolName);
  }

  /**
   * List registered tools (returns enabled tool names)
   */
  listTools(): string[] {
    return this._agentContext.tools.listEnabled();
  }

  /**
   * Replace all tools with a new array
   */
  setTools(tools: ToolFunction[]): void {
    this._agentContext.tools.clear();
    for (const tool of tools) {
      this._agentContext.tools.register(tool);
      if (tool.permission) {
        this._permissionManager.setToolConfig(tool.definition.function.name, tool.permission);
      }
    }
  }

  /**
   * Get enabled tool definitions (for passing to LLM).
   * This is a helper that extracts definitions from enabled tools.
   */
  protected getEnabledToolDefinitions(): import('../domain/entities/Tool.js').FunctionToolDefinition[] {
    return this._agentContext.tools.getEnabled().map((t) => t.definition);
  }

  // ===== Direct LLM Access (Bypasses AgentContext) =====

  /**
   * Get or create the provider for direct calls.
   * Lazily initialized to avoid creating provider if not used.
   */
  private getDirectProvider(): ITextProvider {
    if (!this._directProvider) {
      this._directProvider = createProvider(this.connector);
    }
    return this._directProvider;
  }

  /**
   * Make a direct LLM call bypassing all context management.
   *
   * This method:
   * - Does NOT track messages in history
   * - Does NOT use AgentContext features (memory, cache, etc.)
   * - Does NOT prepare context or run compaction
   * - Does NOT go through the agentic loop (no tool execution)
   *
   * Use this for simple, stateless interactions where you want raw LLM access
   * without the overhead of context management.
   *
   * @param input - Text string or array of InputItems (supports multimodal: text + images)
   * @param options - Optional configuration for the call
   * @returns Raw LLM response
   *
   * @example
   * ```typescript
   * // Simple text call
   * const response = await agent.runDirect('What is 2 + 2?');
   * console.log(response.output_text);
   *
   * // With options
   * const response = await agent.runDirect('Summarize this', {
   *   instructions: 'Be concise',
   *   temperature: 0.5,
   * });
   *
   * // Multimodal (text + image)
   * const response = await agent.runDirect([
   *   { type: 'message', role: 'user', content: [
   *     { type: 'input_text', text: 'What is in this image?' },
   *     { type: 'input_image', image_url: 'https://...' }
   *   ]}
   * ]);
   *
   * // With tools (single call, no loop)
   * const response = await agent.runDirect('Get the weather', {
   *   includeTools: true,
   * });
   * // Note: If the LLM returns a tool call, you must handle it yourself
   * ```
   */
  async runDirect(
    input: string | InputItem[],
    options: DirectCallOptions = {}
  ): Promise<LLMResponse> {
    if (this._isDestroyed) {
      throw new Error('Agent has been destroyed');
    }

    const provider = this.getDirectProvider();

    const generateOptions = {
      model: this.model,
      input,
      instructions: options.instructions,
      tools: options.includeTools ? this.getEnabledToolDefinitions() : undefined,
      temperature: options.temperature,
      max_output_tokens: options.maxOutputTokens,
      response_format: options.responseFormat,
      vendorOptions: options.vendorOptions,
    };

    this._logger.debug({ inputType: typeof input }, 'runDirect called');

    try {
      const response = await provider.generate(generateOptions);
      this._logger.debug({ outputLength: response.output_text?.length }, 'runDirect completed');
      return response;
    } catch (error) {
      this._logger.error({ error: (error as Error).message }, 'runDirect failed');
      throw error;
    }
  }

  /**
   * Stream a direct LLM call bypassing all context management.
   *
   * Same as runDirect but returns a stream of events instead of waiting
   * for the complete response. Useful for real-time output display.
   *
   * @param input - Text string or array of InputItems (supports multimodal)
   * @param options - Optional configuration for the call
   * @returns Async iterator of stream events
   *
   * @example
   * ```typescript
   * for await (const event of agent.streamDirect('Tell me a story')) {
   *   if (event.type === 'output_text_delta') {
   *     process.stdout.write(event.delta);
   *   }
   * }
   * ```
   */
  async *streamDirect(
    input: string | InputItem[],
    options: DirectCallOptions = {}
  ): AsyncIterableIterator<StreamEvent> {
    if (this._isDestroyed) {
      throw new Error('Agent has been destroyed');
    }

    const provider = this.getDirectProvider();

    const generateOptions = {
      model: this.model,
      input,
      instructions: options.instructions,
      tools: options.includeTools ? this.getEnabledToolDefinitions() : undefined,
      temperature: options.temperature,
      max_output_tokens: options.maxOutputTokens,
      response_format: options.responseFormat,
      vendorOptions: options.vendorOptions,
    };

    this._logger.debug({ inputType: typeof input }, 'streamDirect called');

    try {
      yield* provider.streamGenerate(generateOptions);
      this._logger.debug('streamDirect completed');
    } catch (error) {
      this._logger.error({ error: (error as Error).message }, 'streamDirect failed');
      throw error;
    }
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
   * Invoke beforeCompaction hook if defined.
   * Call this before context compaction occurs.
   * Gives the agent a chance to save important data to memory.
   */
  protected async invokeBeforeCompaction(context: BeforeCompactionContext): Promise<void> {
    if (this._lifecycleHooks.beforeCompaction) {
      try {
        await this._lifecycleHooks.beforeCompaction(context);
      } catch (error) {
        this._logger.error(
          {
            error: (error as Error).message,
            strategy: context.strategy,
            estimatedTokensToFree: context.estimatedTokensToFree,
          },
          'beforeCompaction hook failed'
        );
        // Don't re-throw - allow compaction to continue
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

    // Stop auto-save interval
    if (this._autoSaveInterval) {
      clearInterval(this._autoSaveInterval);
      this._autoSaveInterval = null;
    }

    // Cleanup AgentContext (handles tools, memory, cache, plugins)
    this._agentContext.destroy();

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
