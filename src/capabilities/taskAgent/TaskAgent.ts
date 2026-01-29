/**
 * TaskAgent - autonomous task-based agent
 *
 * Extends BaseAgent to inherit:
 * - Connector resolution
 * - Tool manager initialization
 * - Permission manager initialization
 * - Session management
 * - Lifecycle/cleanup
 *
 * Uses unified ContextManager with TaskAgentContextProvider
 * and IHistoryManager interface for clean architecture.
 */

import { BaseAgent, BaseAgentConfig, BaseSessionConfig } from '../../core/BaseAgent.js';
import { Connector } from '../../core/Connector.js';
import { Agent } from '../../core/Agent.js';
import {
  Session,
  ISessionStorage,
  SerializedPlan,
  SerializedMemory,
} from '../../core/SessionManager.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { Plan, PlanInput, Task, TaskInput, TaskValidationResult, createPlan, createTask, detectDependencyCycle } from '../../domain/entities/Task.js';
import { DependencyCycleError } from '../../domain/errors/AIErrors.js';
import { AgentState, AgentStatus, createAgentState, updateAgentStatus } from '../../domain/entities/AgentState.js';
import type { WorkingMemoryConfig } from '../../domain/entities/Memory.js';
import { DEFAULT_MEMORY_CONFIG } from '../../domain/entities/Memory.js';
import { IAgentStorage, createAgentStorage } from '../../infrastructure/storage/InMemoryStorage.js';
import { WorkingMemory } from './WorkingMemory.js';
// Unified ContextManager from core
import { ContextManager } from '../../core/context/ContextManager.js';
import { TaskAgentContextProvider } from '../../infrastructure/context/providers/TaskAgentContextProvider.js';
import { TruncateCompactor } from '../../infrastructure/context/compactors/TruncateCompactor.js';
import { MemoryEvictionCompactor } from '../../infrastructure/context/compactors/MemoryEvictionCompactor.js';
import { ApproximateTokenEstimator } from '../../infrastructure/context/estimators/ApproximateEstimator.js';
import { IdempotencyCache, DEFAULT_IDEMPOTENCY_CONFIG } from './IdempotencyCache.js';
// Unified IHistoryManager
import type { IHistoryManager } from '../../domain/interfaces/IHistoryManager.js';
import { ConversationHistoryManager } from '../../core/history/ConversationHistoryManager.js';
import { ExternalDependencyHandler } from './ExternalDependencyHandler.js';
import { PlanExecutor } from './PlanExecutor.js';
import { CheckpointManager, DEFAULT_CHECKPOINT_STRATEGY } from './CheckpointManager.js';
import { createMemoryTools } from './memoryTools.js';
import { createContextTools } from './contextTools.js';
import { getModelInfo } from '../../domain/entities/Model.js';
import type { AgentPermissionsConfig } from '../../core/permissions/types.js';
import { CONTEXT_DEFAULTS } from '../../core/constants.js';

// ============================================================================
// Unified Context Access Interface
// ============================================================================

/**
 * TaskAgentContextAccess provides AgentContext-compatible access
 * to TaskAgent's internal managers for unified API access.
 *
 * This allows users to interact with TaskAgent using the same
 * patterns as AgentContext without breaking TaskAgent's internal architecture.
 */
export interface TaskAgentContextAccess {
  /** Working memory */
  readonly memory: WorkingMemory;
  /** Tool result cache */
  readonly cache: IdempotencyCache;
  /** History manager */
  readonly history: IHistoryManager;
  /** Context manager for LLM context preparation */
  readonly contextManager: ContextManager;
  /** Permission manager (from BaseAgent) */
  readonly permissions: import('../../core/permissions/ToolPermissionManager.js').ToolPermissionManager;
  /** Tool manager (from BaseAgent) */
  readonly tools: import('../../core/ToolManager.js').ToolManager;

  /** Add a message to history (fire and forget) */
  addMessage(role: 'user' | 'assistant' | 'system', content: string): void;

  /** Get current context budget */
  getBudget(): Promise<import('../../core/context/types.js').ContextBudget>;

  /** Get context metrics */
  getMetrics(): Promise<{
    historyMessageCount: number;
    memoryStats: { totalEntries: number; totalSizeBytes: number };
    cacheStats: import('../../core/IdempotencyCache.js').CacheStats;
  }>;
}

/**
 * TaskAgent hooks for customization
 */
export interface TaskAgentHooks {
  /** Before agent starts executing */
  onStart?: (agent: TaskAgent, plan: Plan) => Promise<void>;

  /** Before each task starts */
  beforeTask?: (task: Task, context: TaskContext) => Promise<void | 'skip'>;

  /** After each task completes */
  afterTask?: (task: Task, result: TaskResult) => Promise<void>;

  /**
   * Validate task completion with custom logic.
   * Called after task execution to verify the task achieved its goal.
   *
   * Return values:
   * - `TaskValidationResult`: Full validation result with score and details
   * - `true`: Task is complete
   * - `false`: Task failed validation (will use default error message)
   * - `string`: Task failed validation with custom reason
   *
   * If not provided, the default LLM self-reflection validation is used
   * (when task.validation is configured).
   */
  validateTask?: (
    task: Task,
    result: TaskResult,
    memory: WorkingMemory
  ) => Promise<TaskValidationResult | boolean | string>;

  /** Before each LLM call */
  beforeLLMCall?: (messages: any[], options: any) => Promise<any[]>;

  /** After each LLM response */
  afterLLMCall?: (response: any) => Promise<void>;

  /** Before each tool execution */
  beforeTool?: (tool: ToolFunction, args: unknown) => Promise<unknown>;

  /** After tool execution */
  afterTool?: (tool: ToolFunction, args: unknown, result: unknown) => Promise<unknown>;

  /** On any error */
  onError?: (error: Error, context: ErrorContext) => Promise<'retry' | 'fail' | 'skip'>;

  /** On agent completion */
  onComplete?: (result: PlanResult) => Promise<void>;
}

/**
 * Task execution context
 */
export interface TaskContext {
  taskId: string;
  taskName: string;
  attempt: number;
}

/**
 * Task result
 */
export interface TaskResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Error context
 */
export interface ErrorContext {
  task?: Task;
  error: Error;
  phase: 'tool' | 'llm' | 'execution';
}

/**
 * Plan result
 */
export interface PlanResult {
  status: 'completed' | 'failed' | 'cancelled';
  output?: unknown;
  error?: string;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    skippedTasks: number;
  };
}

/**
 * Agent handle returned from start()
 */
export interface AgentHandle {
  agentId: string;
  planId: string;

  /** Wait for completion */
  wait(): Promise<PlanResult>;

  /** Get current status */
  status(): AgentStatus;
}

/**
 * Plan updates specification
 */
export interface PlanUpdates {
  addTasks?: TaskInput[];
  updateTasks?: Array<{ id: string } & Partial<Task>>;
  removeTasks?: string[];
}

/**
 * Options for plan update validation
 */
export interface PlanUpdateOptions {
  /**
   * Allow removing tasks that are currently in_progress.
   * @default false
   */
  allowRemoveActiveTasks?: boolean;

  /**
   * Validate that no dependency cycles exist after the update.
   * @default true
   */
  validateCycles?: boolean;
}

/**
 * Session configuration for TaskAgent - extends BaseSessionConfig
 */
export interface TaskAgentSessionConfig extends BaseSessionConfig {
  // TaskAgent-specific session options can be added here
}

/**
 * TaskAgent configuration - extends BaseAgentConfig
 */
export interface TaskAgentConfig extends BaseAgentConfig {
  /** System instructions for the agent */
  instructions?: string;

  /** Temperature for generation */
  temperature?: number;

  /** Maximum iterations for tool calling loop */
  maxIterations?: number;

  /** Storage for persistence (agent state, checkpoints) */
  storage?: IAgentStorage;

  /** Memory configuration */
  memoryConfig?: WorkingMemoryConfig;

  /** Hooks for customization */
  hooks?: TaskAgentHooks;

  /** Session configuration - extends base type */
  session?: TaskAgentSessionConfig;

  /** Permission configuration for tool execution approval */
  permissions?: AgentPermissionsConfig;
}

/**
 * TaskAgent events - extends BaseAgentEvents
 */
export interface TaskAgentEvents {
  'task:start': { task: Task };
  'task:complete': { task: Task; result: TaskResult };
  'task:failed': { task: Task; error: Error };
  'task:validation_failed': { task: Task; validation: TaskValidationResult };
  'task:waiting': { task: Task; dependency: any };
  'plan:updated': { plan: Plan };
  'agent:suspended': { reason: string };
  'agent:resumed': Record<string, never>;
  'agent:completed': { result: PlanResult };
  'memory:stored': { key: string; description: string };
  'memory:limit_warning': { utilization: number };
  // Inherited from BaseAgentEvents
  'session:saved': { sessionId: string };
  'session:loaded': { sessionId: string };
  destroyed: void;
}

/**
 * TaskAgent - autonomous task-based agent.
 *
 * Extends BaseAgent to inherit connector resolution, tool management,
 * permission management, session management, and lifecycle.
 *
 * Features:
 * - Plan-driven execution
 * - Working memory with indexed access
 * - External dependency handling (webhooks, polling, manual)
 * - Suspend/resume capability
 * - State persistence for long-running agents
 */
export class TaskAgent extends BaseAgent<TaskAgentConfig, TaskAgentEvents> {
  readonly id: string;
  protected state: AgentState;
  protected agentStorage: IAgentStorage;
  protected memory: WorkingMemory;
  protected hooks?: TaskAgentHooks;
  protected executionPromise?: Promise<PlanResult>;

  // Internal components
  protected agent?: Agent;
  protected contextManager?: ContextManager;
  protected contextProvider?: TaskAgentContextProvider;
  protected idempotencyCache?: IdempotencyCache;
  protected historyManager?: IHistoryManager;
  protected externalHandler?: ExternalDependencyHandler;
  protected planExecutor?: PlanExecutor;
  protected checkpointManager?: CheckpointManager;
  protected _allTools: ToolFunction[] = [];

  // Event listener cleanup tracking
  private eventCleanupFunctions: Array<() => void> = [];

  // ===== Static Factory =====

  /**
   * Create a new TaskAgent
   */
  static create(config: TaskAgentConfig): TaskAgent {
    // Resolve connector (use Connector.get directly since we're in static method)
    const connector =
      typeof config.connector === 'string' ? Connector.get(config.connector) : config.connector;

    if (!connector) {
      throw new Error(`Connector "${config.connector}" not found`);
    }

    // Create agent storage
    const agentStorage = config.storage ?? createAgentStorage({});

    // Create working memory
    const memoryConfig = config.memoryConfig ?? DEFAULT_MEMORY_CONFIG;
    const memory = new WorkingMemory(agentStorage.memory, memoryConfig);

    // Generate agent ID
    const id = `task-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create empty initial plan (will be set on start)
    const emptyPlan = createPlan({ goal: '', tasks: [] });

    const agentStateConfig = {
      connectorName: typeof config.connector === 'string' ? config.connector : connector.name,
      model: config.model,
      temperature: config.temperature,
      maxIterations: config.maxIterations,
      toolNames: (config.tools ?? []).map((t) => t.definition.function.name),
    };

    const state = createAgentState(id, agentStateConfig, emptyPlan);

    const taskAgent = new TaskAgent(id, state, agentStorage, memory, config, config.hooks);

    // Initialize components
    taskAgent.initializeComponents(config);

    return taskAgent;
  }

  /**
   * Resume an existing agent from storage
   */
  static async resume(
    agentId: string,
    options: { storage: IAgentStorage; tools?: ToolFunction[]; hooks?: TaskAgentHooks; session?: { storage: ISessionStorage } }
  ): Promise<TaskAgent> {
    const state = await options.storage.agent.load(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not found in storage`);
    }

    // Validate tool names match saved state
    const stateToolNames = new Set(state.config.toolNames ?? []);
    const currentToolNames = new Set(
      (options.tools ?? []).map((t) => t.definition.function.name)
    );

    const missing = [...stateToolNames].filter((n) => !currentToolNames.has(n));
    const added = [...currentToolNames].filter((n) => !stateToolNames.has(n));

    if (missing.length > 0) {
      console.warn(
        `[TaskAgent.resume] Warning: Missing tools from saved state: ${missing.join(', ')}. ` +
          `Tasks requiring these tools may fail.`
      );
    }

    if (added.length > 0) {
      console.info(
        `[TaskAgent.resume] Info: New tools not in saved state: ${added.join(', ')}`
      );
    }

    // Recreate config from state
    const config: TaskAgentConfig = {
      connector: state.config.connectorName,
      model: state.config.model,
      tools: options.tools ?? [],
      temperature: state.config.temperature,
      maxIterations: state.config.maxIterations,
      storage: options.storage,
      hooks: options.hooks,
      session: options.session,
    };

    // Create working memory from stored state
    const memory = new WorkingMemory(options.storage.memory, DEFAULT_MEMORY_CONFIG);

    const taskAgent = new TaskAgent(agentId, state, options.storage, memory, config, options.hooks);

    // Initialize components
    taskAgent.initializeComponents(config);

    return taskAgent;
  }

  // ===== Constructor =====

  protected constructor(
    id: string,
    state: AgentState,
    agentStorage: IAgentStorage,
    memory: WorkingMemory,
    config: TaskAgentConfig,
    hooks?: TaskAgentHooks
  ) {
    // Call BaseAgent constructor - it handles connector resolution,
    // tool manager init, permission manager init
    super(config, 'TaskAgent');

    this.id = id;
    this.state = state;
    this.agentStorage = agentStorage;
    this.memory = memory;
    this.hooks = hooks;

    // Forward memory events to agent (with cleanup tracking)
    const storedHandler = (data: { key: string; description: string }) =>
      this.emit('memory:stored', data);
    const limitWarningHandler = (data: { utilizationPercent: number }) =>
      this.emit('memory:limit_warning', { utilization: data.utilizationPercent });

    memory.on('stored', storedHandler);
    memory.on('limit_warning', limitWarningHandler);

    // Track cleanup functions
    this.eventCleanupFunctions.push(() => memory.off('stored', storedHandler));
    this.eventCleanupFunctions.push(() => memory.off('limit_warning', limitWarningHandler));

    // Initialize session (from BaseAgent)
    this.initializeSession(config.session);
  }

  // ===== Abstract Method Implementations =====

  protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent' {
    return 'task-agent';
  }

  protected prepareSessionState(): void {
    // TaskAgent-specific session state is handled by getSerializedPlan() and getSerializedMemory()
    // Store any additional custom state here if needed
  }

  protected async restoreSessionState(session: Session): Promise<void> {
    // Restore plan from session
    if (session.plan?.data) {
      this.state.plan = session.plan.data as Plan;
    }

    // Memory entries are stored in agent storage, not in session
    // The session just tracks metadata - actual restoration happens through agentStorage.memory
    this._logger.debug({ sessionId: session.id }, 'TaskAgent session state restored');
  }

  protected getSerializedPlan(): SerializedPlan | undefined {
    if (!this.state.plan) {
      return undefined;
    }
    return {
      version: 1,
      data: this.state.plan,
    };
  }

  protected getSerializedMemory(): SerializedMemory | undefined {
    // Note: This is called synchronously from saveSession, but we need async for memory index
    // BaseAgent's saveSession will handle this, but we return undefined here
    // and override saveSession to handle memory properly
    return undefined;
  }

  // Override saveSession to handle async memory serialization
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

    // Get plan state
    const plan = this.getSerializedPlan();
    if (plan) {
      this._session.plan = plan;
    }

    // Get memory state (async)
    const memoryIndex = await this.memory.getIndex();
    this._session.memory = {
      version: 1,
      entries: memoryIndex.entries.map((e) => ({
        key: e.key,
        description: e.description,
        value: null, // Don't serialize full values, they're in agent storage
        scope: e.scope,
        sizeBytes: 0,
        basePriority: e.effectivePriority,
        pinned: e.pinned,
      })),
    };

    // Let subclass add any additional specific state
    this.prepareSessionState();

    await this._sessionManager.save(this._session);
    this._logger.debug({ sessionId: this._session.id }, 'TaskAgent session saved');
  }

  // ===== Component Initialization =====

  /**
   * Wrap a tool with idempotency cache and enhanced context
   */
  private wrapToolWithCache(tool: ToolFunction): ToolFunction {
    return {
      ...tool,
      execute: async (args: any, context?: any) => {
        // Enhance context with TaskAgent-specific properties
        const enhancedContext = {
          ...context,
          memory: this.memory.getAccess(),    // Add memory access for memory tools
          contextManager: this.contextManager,
          idempotencyCache: this.idempotencyCache,
          agentId: this.id,
        };

        if (!this.idempotencyCache) {
          return tool.execute(args, enhancedContext);
        }

        // Check cache first
        const cached = await this.idempotencyCache.get(tool, args);
        if (cached !== undefined) {
          return cached;
        }

        // Execute tool with enhanced context
        const result = await tool.execute(args, enhancedContext);

        // Cache result
        await this.idempotencyCache.set(tool, args, result);

        return result;
      }
    };
  }

  /**
   * Initialize internal components
   */
  private initializeComponents(config: TaskAgentConfig): void {
    // Combine user tools with memory tools and context tools
    const memoryTools = createMemoryTools();
    const contextTools = createContextTools();
    this._allTools = [...(config.tools ?? []), ...memoryTools, ...contextTools];

    // Register tools with ToolManager (use inherited method from BaseAgent)
    this.registerTools(this._toolManager, this._allTools);

    // Create idempotency cache first (needed for wrapping tools)
    this.idempotencyCache = new IdempotencyCache(DEFAULT_IDEMPOTENCY_CONFIG);

    // Get enabled tools from ToolManager and wrap with cache
    const enabledTools = this._toolManager.getEnabled();
    const cachedTools = enabledTools.map((tool) => this.wrapToolWithCache(tool));

    // Create base Agent for LLM calls
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: cachedTools,
      instructions: config.instructions,
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 10,
      permissions: config.permissions,
    });

    // Calculate context limit from model
    const modelInfo = getModelInfo(config.model);
    const contextTokens = modelInfo?.features.input.tokens ?? CONTEXT_DEFAULTS.MAX_TOKENS;

    // Create unified history manager (IHistoryManager interface)
    this.historyManager = new ConversationHistoryManager({
      maxMessages: 50,
      maxTokens: Math.floor(contextTokens * 0.3), // Reserve 30% for history
      compactionStrategy: 'sliding-window',
      preserveRecentCount: 10,
    });

    // Create context provider for TaskAgent
    this.contextProvider = new TaskAgentContextProvider({
      model: config.model,
      instructions: config.instructions,
      plan: this.state.plan,
      memory: this.memory,
      historyManager: this.historyManager,
    });

    // Create unified ContextManager with compactors
    const estimator = new ApproximateTokenEstimator();
    this.contextManager = new ContextManager(
      this.contextProvider,
      {
        maxContextTokens: contextTokens,
        compactionThreshold: 0.75,
        hardLimit: 0.9,
        responseReserve: 0.15,
        autoCompact: true,
        strategy: 'proactive',
      },
      [
        new TruncateCompactor(estimator),
        new MemoryEvictionCompactor(estimator),
      ],
      estimator
    );

    // Create external dependency handler
    this.externalHandler = new ExternalDependencyHandler(this._allTools);

    // Create checkpoint manager
    this.checkpointManager = new CheckpointManager(this.agentStorage, DEFAULT_CHECKPOINT_STRATEGY);

    // Create plan executor with unified components
    this.planExecutor = new PlanExecutor(
      this.agent,
      this.memory,
      this.contextManager,
      this.contextProvider,
      this.idempotencyCache!,
      this.historyManager,
      this.externalHandler,
      this.checkpointManager,
      this.hooks,
      {
        maxIterations: config.maxIterations ?? 100,
      }
    );

    // Forward events from plan executor to task agent (with cleanup tracking)
    this.setupPlanExecutorEvents();
  }

  /**
   * Setup event forwarding from PlanExecutor
   */
  private setupPlanExecutorEvents(): void {
    if (!this.planExecutor) return;

    const taskStartHandler = (data: { task: Task }) => this.emit('task:start', data);
    const taskCompleteHandler = (data: { task: Task; result: unknown }) => {
      this.emit('task:complete', { task: data.task, result: { success: true, output: data.result } });
      // Call afterTask hook
      if (this.hooks?.afterTask) {
        this.hooks.afterTask(data.task, { success: true, output: data.result });
      }
    };
    const taskFailedHandler = (data: { task: Task; error: Error }) => this.emit('task:failed', data);
    const taskSkippedHandler = (data: { task: Task; reason: string }) =>
      this.emit('task:failed', { task: data.task, error: new Error(data.reason) });
    const taskWaitingExternalHandler = (data: { task: Task }) =>
      this.emit('task:waiting', { task: data.task, dependency: data.task.externalDependency });
    const taskValidationFailedHandler = (data: { task: Task; validation: TaskValidationResult }) =>
      this.emit('task:validation_failed', data);

    this.planExecutor.on('task:start', taskStartHandler);
    this.planExecutor.on('task:complete', taskCompleteHandler);
    this.planExecutor.on('task:failed', taskFailedHandler);
    this.planExecutor.on('task:skipped', taskSkippedHandler);
    this.planExecutor.on('task:waiting_external', taskWaitingExternalHandler);
    this.planExecutor.on('task:validation_failed', taskValidationFailedHandler);
    this.planExecutor.on('task:validation_uncertain', taskValidationFailedHandler);

    // Track cleanup functions
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:start', taskStartHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:complete', taskCompleteHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:failed', taskFailedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:skipped', taskSkippedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:waiting_external', taskWaitingExternalHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:validation_failed', taskValidationFailedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:validation_uncertain', taskValidationFailedHandler));
  }

  // ===== Public API =====

  // ===== Unified Context Access =====

  /**
   * Get unified context access interface.
   *
   * Provides AgentContext-compatible access to TaskAgent's internal managers,
   * allowing users to interact with the same unified API across all agent types.
   *
   * @example
   * ```typescript
   * const taskAgent = TaskAgent.create({ ... });
   *
   * // Access context features (same API as AgentContext)
   * taskAgent.context.addMessage('user', 'Hello');
   * const budget = await taskAgent.context.getBudget();
   * const metrics = await taskAgent.context.getMetrics();
   *
   * // Direct access to managers
   * await taskAgent.context.memory.store('key', 'desc', value);
   * const cached = await taskAgent.context.cache.get(tool, args);
   * ```
   */
  get context(): TaskAgentContextAccess {
    // Ensure components are initialized
    if (!this.idempotencyCache || !this.historyManager || !this.contextManager) {
      throw new Error('TaskAgent components not initialized. Call start() first or use create().');
    }

    const self = this;
    return {
      get memory() { return self.memory; },
      get cache() { return self.idempotencyCache!; },
      get history() { return self.historyManager!; },
      get contextManager() { return self.contextManager!; },
      get permissions() { return self._permissionManager; },
      get tools() { return self._toolManager; },

      addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
        // Fire and forget - don't await since interface is sync
        self.historyManager?.addMessage(role, content).catch(err => {
          console.warn('Failed to add message to history:', err);
        });
      },

      async getBudget() {
        if (!self.contextManager) {
          throw new Error('Context manager not initialized');
        }
        // Try to get cached budget first, otherwise prepare context
        const cached = self.contextManager.getCurrentBudget();
        if (cached) {
          return cached;
        }
        const prepared = await self.contextManager.prepare();
        return prepared.budget;
      },

      async getMetrics() {
        const memoryStats = await self.memory.getStats();
        const cacheStats = self.idempotencyCache?.getStats() ?? {
          entries: 0,
          hits: 0,
          misses: 0,
          hitRate: 0,
        };
        const messages = await self.historyManager?.getMessages() ?? [];

        return {
          historyMessageCount: messages.length,
          memoryStats: {
            totalEntries: memoryStats.totalEntries,
            totalSizeBytes: memoryStats.totalSizeBytes,
          },
          cacheStats,
        };
      },
    };
  }

  /**
   * Check if context is available (components initialized)
   */
  hasContext(): boolean {
    return !!(this.idempotencyCache && this.historyManager && this.contextManager);
  }

  /**
   * Start executing a plan
   */
  async start(planInput: PlanInput): Promise<AgentHandle> {
    // Create plan
    const plan = createPlan(planInput);
    this.state.plan = plan;
    this.state = updateAgentStatus(this.state, 'running');

    // Call onStart hook
    if (this.hooks?.onStart) {
      await this.hooks.onStart(this, plan);
    }

    // Start execution and store promise
    this.executionPromise = this.executePlan()
      .then(async (result) => {
        // Call onComplete hook after execution finishes
        if (this.hooks?.onComplete) {
          await this.hooks.onComplete(result);
        }
        return result;
      })
      .catch(async (error) => {
        // Call onError hook on failure
        if (this.hooks?.onError) {
          await this.hooks.onError(error, { error, phase: 'execution' });
        }
        throw error;
      });

    // For sync-like behavior in tests, await completion
    await this.executionPromise.catch(() => {
      // Swallow error here, it will be re-thrown when wait() is called
    });

    // Return handle
    return {
      agentId: this.id,
      planId: plan.id,
      wait: async () => {
        if (!this.executionPromise) {
          throw new Error('No execution in progress');
        }
        return this.executionPromise;
      },
      status: () => this.state.status,
    };
  }

  /**
   * Pause execution
   */
  async pause(): Promise<void> {
    this.state = updateAgentStatus(this.state, 'suspended');
    this.state.plan.status = 'suspended';

    this.emit('agent:suspended', { reason: 'manual_pause' });
  }

  /**
   * Resume execution after pause
   * Note: Named resumeExecution to avoid conflict with BaseAgent if any
   */
  async resume(): Promise<void> {
    this.state = updateAgentStatus(this.state, 'running');
    this.state.plan.status = 'running';

    this.emit('agent:resumed', {});

    // Continue execution
    await this.executePlan();
  }

  /**
   * Cancel execution
   */
  async cancel(): Promise<void> {
    this.state = updateAgentStatus(this.state, 'cancelled');
    this.state.plan.status = 'cancelled';
  }

  /**
   * Trigger external dependency completion
   */
  async triggerExternal(webhookId: string, data: unknown): Promise<void> {
    const plan = this.state.plan;
    if (!plan) {
      throw new Error('No plan running');
    }

    // Find task with this webhook
    const task = plan.tasks.find((t) => t.externalDependency?.webhookId === webhookId);

    if (!task || !task.externalDependency) {
      throw new Error(`Task waiting on webhook ${webhookId} not found`);
    }

    // Mark as received
    task.externalDependency.state = 'received';
    task.externalDependency.receivedData = data;
    task.externalDependency.receivedAt = Date.now();

    // Resume execution
    await this.resume();
  }

  /**
   * Manually complete a task
   */
  async completeTaskManually(taskId: string, result: unknown): Promise<void> {
    const plan = this.state.plan;
    if (!plan) {
      throw new Error('No plan running');
    }

    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task || !task.externalDependency) {
      throw new Error(`Task ${taskId} not found or not waiting on manual input`);
    }

    // Mark as received
    task.externalDependency.state = 'received';
    task.externalDependency.receivedData = result;
    task.externalDependency.receivedAt = Date.now();
  }

  /**
   * Update the plan with validation
   *
   * @param updates - The updates to apply to the plan
   * @param options - Validation options
   * @throws Error if validation fails
   */
  async updatePlan(updates: PlanUpdates, options?: PlanUpdateOptions): Promise<void> {
    const plan = this.state.plan;
    if (!plan) {
      throw new Error('No plan running');
    }

    if (!plan.allowDynamicTasks && (updates.addTasks || updates.removeTasks)) {
      throw new Error('Dynamic tasks are disabled for this plan');
    }

    const opts = {
      allowRemoveActiveTasks: options?.allowRemoveActiveTasks ?? false,
      validateCycles: options?.validateCycles ?? true,
    };

    // Validate: don't remove in_progress tasks unless explicitly allowed
    if (!opts.allowRemoveActiveTasks && updates.removeTasks && updates.removeTasks.length > 0) {
      const activeTasks = plan.tasks.filter(
        (t) => t.status === 'in_progress' && updates.removeTasks!.includes(t.id)
      );
      if (activeTasks.length > 0) {
        const names = activeTasks.map((t) => t.name).join(', ');
        throw new Error(`Cannot remove active tasks: ${names}. Set allowRemoveActiveTasks: true to override.`);
      }
    }

    // Add tasks
    if (updates.addTasks) {
      for (const taskInput of updates.addTasks) {
        const task = createTask(taskInput);
        plan.tasks.push(task);
      }
    }

    // Update tasks
    if (updates.updateTasks) {
      for (const update of updates.updateTasks) {
        const task = plan.tasks.find((t) => t.id === update.id);
        if (task) {
          Object.assign(task, update);
        }
      }
    }

    // Remove tasks
    if (updates.removeTasks) {
      plan.tasks = plan.tasks.filter((t) => !updates.removeTasks!.includes(t.id));
    }

    // Validate: check for cycles after update
    if (opts.validateCycles) {
      const cycle = detectDependencyCycle(plan.tasks);
      if (cycle) {
        // Convert task IDs to names for better error message
        const cycleNames = cycle.map((taskId) => {
          const task = plan.tasks.find((t) => t.id === taskId);
          return task ? task.name : taskId;
        });
        throw new DependencyCycleError(cycleNames, plan.id);
      }
    }

    plan.lastUpdatedAt = Date.now();

    this.emit('plan:updated', { plan });
  }

  // ===== State Introspection =====

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Get current plan
   */
  getPlan(): Plan {
    if (!this.state.plan || !this.state.plan.goal) {
      throw new Error('No plan started');
    }
    return this.state.plan;
  }

  /**
   * Get working memory
   */
  getMemory(): WorkingMemory {
    return this.memory;
  }

  // ===== Plan Execution =====

  /**
   * Execute the plan (internal)
   */
  protected async executePlan(): Promise<PlanResult> {
    const plan = this.state.plan;

    if (!this.planExecutor) {
      throw new Error('Plan executor not initialized');
    }

    try {
      // Execute the plan
      const execResult = await this.planExecutor.execute(plan, this.state);

      // Update metrics from execution
      if (execResult.metrics) {
        this.state.metrics.totalLLMCalls += execResult.metrics.totalLLMCalls;
        this.state.metrics.totalToolCalls += execResult.metrics.totalToolCalls;
        this.state.metrics.totalTokensUsed += execResult.metrics.totalTokensUsed;
        this.state.metrics.totalCost += execResult.metrics.totalCost;
      }

      // Update agent state
      if (execResult.status === 'completed') {
        this.state = updateAgentStatus(this.state, 'completed');
        plan.status = 'completed';
      } else if (execResult.status === 'failed') {
        this.state = updateAgentStatus(this.state, 'failed');
        plan.status = 'failed';
      } else if (execResult.status === 'suspended') {
        this.state = updateAgentStatus(this.state, 'suspended');
        plan.status = 'suspended';
      }

      // Final checkpoint
      await this.checkpointManager?.checkpoint(this.state, 'execution_complete');

      const result: PlanResult = {
        status: execResult.status === 'suspended' ? 'completed' : execResult.status,
        metrics: {
          totalTasks: plan.tasks.length,
          completedTasks: execResult.completedTasks,
          failedTasks: execResult.failedTasks,
          skippedTasks: execResult.skippedTasks,
        },
      };

      this.emit('agent:completed', { result });

      return result;
    } catch (error) {
      // Handle execution error
      const err = error instanceof Error ? error : new Error(String(error));

      this.state = updateAgentStatus(this.state, 'failed');
      plan.status = 'failed';

      // Try to checkpoint the failure
      try {
        await this.checkpointManager?.checkpoint(this.state, 'execution_failed');
      } catch {
        // Ignore checkpoint errors during failure handling
      }

      const result: PlanResult = {
        status: 'failed',
        error: err.message,
        metrics: {
          totalTasks: plan.tasks.length,
          completedTasks: plan.tasks.filter((t) => t.status === 'completed').length,
          failedTasks: plan.tasks.filter((t) => t.status === 'failed').length,
          skippedTasks: plan.tasks.filter((t) => t.status === 'skipped').length,
        },
      };

      this.emit('agent:completed', { result });

      throw err;
    }
  }

  // ===== Cleanup =====

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this._isDestroyed) {
      return;
    }

    this._logger.debug('TaskAgent destroy started');

    // Remove all event listeners first
    this.eventCleanupFunctions.forEach((cleanup) => cleanup());
    this.eventCleanupFunctions = [];

    // Cleanup components
    this.externalHandler?.cleanup();
    await this.checkpointManager?.cleanup();
    this.planExecutor?.cleanup();
    this.agent?.destroy();

    // Run cleanup callbacks
    await this.runCleanupCallbacks();

    // Call base destroy (handles session, tool manager, permission manager cleanup)
    this.baseDestroy();

    this._logger.debug('TaskAgent destroyed');
  }
}
