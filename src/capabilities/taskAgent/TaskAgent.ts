/**
 * TaskAgent - autonomous task-based agent
 */

import { EventEmitter } from 'eventemitter3';
import { Connector } from '../../core/Connector.js';
import { Agent } from '../../core/Agent.js';
import { ToolManager } from '../../core/ToolManager.js';
import {
  SessionManager,
  Session,
  ISessionStorage,
} from '../../core/SessionManager.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { Plan, PlanInput, Task, TaskInput, TaskValidationResult, createPlan, createTask, detectDependencyCycle } from '../../domain/entities/Task.js';
import { DependencyCycleError } from '../../domain/errors/AIErrors.js';
import { AgentState, AgentStatus, createAgentState, updateAgentStatus } from '../../domain/entities/AgentState.js';
import type { WorkingMemoryConfig } from '../../domain/entities/Memory.js';
import { DEFAULT_MEMORY_CONFIG } from '../../domain/entities/Memory.js';
import { IAgentStorage, createAgentStorage } from '../../infrastructure/storage/InMemoryStorage.js';
import { WorkingMemory } from './WorkingMemory.js';
import { ContextManager, DEFAULT_CONTEXT_CONFIG, DEFAULT_COMPACTION_STRATEGY } from './ContextManager.js';
import { IdempotencyCache, DEFAULT_IDEMPOTENCY_CONFIG } from './IdempotencyCache.js';
import { HistoryManager, DEFAULT_HISTORY_CONFIG } from './HistoryManager.js';
import { ExternalDependencyHandler } from './ExternalDependencyHandler.js';
import { PlanExecutor } from './PlanExecutor.js';
import { CheckpointManager, DEFAULT_CHECKPOINT_STRATEGY } from './CheckpointManager.js';
import { createMemoryTools } from './memoryTools.js';
import { createContextTools } from './contextTools.js';
import { getModelInfo } from '../../domain/entities/Model.js';

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
 * Session configuration for TaskAgent
 */
export interface TaskAgentSessionConfig {
  /** Storage backend for sessions */
  storage: ISessionStorage;
  /** Resume existing session by ID */
  id?: string;
  /** Auto-save session after each task completion */
  autoSave?: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs?: number;
}

/**
 * TaskAgent configuration
 */
export interface TaskAgentConfig {
  connector: string | Connector;
  model: string;
  tools?: ToolFunction[];
  instructions?: string;
  temperature?: number;
  maxIterations?: number;

  /** Storage for persistence (agent state, checkpoints) */
  storage?: IAgentStorage;

  /** Memory configuration */
  memoryConfig?: WorkingMemoryConfig;

  /** Hooks for customization */
  hooks?: TaskAgentHooks;

  // === NEW: Optional session support ===
  /** Session configuration for persistence (opt-in) */
  session?: TaskAgentSessionConfig;

  // === NEW: Advanced tool management ===
  /** Provide a pre-configured ToolManager (advanced) */
  toolManager?: ToolManager;

  // === NEW: Tool permission system ===
  /**
   * Permission configuration for tool execution approval.
   * Controls allowlist/blocklist, default scopes, and approval callbacks.
   * Passed through to the internal Agent.
   */
  permissions?: import('../../core/permissions/types.js').AgentPermissionsConfig;
}

/**
 * TaskAgent events
 */
export interface TaskAgentEvents {
  'task:start': { task: Task };
  'task:complete': { task: Task; result: TaskResult };
  'task:failed': { task: Task; error: Error };
  'task:validation_failed': { task: Task; validation: TaskValidationResult };
  'task:waiting': { task: Task; dependency: any };
  'plan:updated': { plan: Plan };
  'agent:suspended': { reason: string };
  'agent:resumed': {};
  'agent:completed': { result: PlanResult };
  'memory:stored': { key: string; description: string };
  'memory:limit_warning': { utilization: number };
}

/**
 * TaskAgent - autonomous task-based agent.
 *
 * Features:
 * - Plan-driven execution
 * - Working memory with indexed access
 * - External dependency handling (webhooks, polling, manual)
 * - Suspend/resume capability
 * - State persistence for long-running agents
 */
export class TaskAgent extends EventEmitter<TaskAgentEvents> {
  readonly id: string;
  protected state: AgentState;
  protected storage: IAgentStorage;
  protected memory: WorkingMemory;
  protected hooks?: TaskAgentHooks;
  protected executionPromise?: Promise<PlanResult>;

  // Internal components
  protected agent?: Agent;
  protected contextManager?: ContextManager;
  protected idempotencyCache?: IdempotencyCache;
  protected historyManager?: HistoryManager;
  protected externalHandler?: ExternalDependencyHandler;
  protected planExecutor?: PlanExecutor;
  protected checkpointManager?: CheckpointManager;
  protected _tools: ToolFunction[] = [];
  protected _toolManager: ToolManager;
  protected config: TaskAgentConfig;

  // Session management (NEW)
  protected _sessionManager: SessionManager | null = null;
  protected _session: Session | null = null;

  // Event listener cleanup tracking
  private eventCleanupFunctions: Array<() => void> = [];

  /**
   * Advanced tool management. Returns ToolManager for fine-grained control.
   */
  get tools(): ToolManager {
    return this._toolManager;
  }

  /**
   * Permission management. Returns ToolPermissionManager for approval control.
   * Delegates to internal Agent's permission manager.
   */
  get permissions() {
    return this.agent?.permissions;
  }

  protected constructor(
    id: string,
    state: AgentState,
    storage: IAgentStorage,
    memory: WorkingMemory,
    config: TaskAgentConfig,
    hooks?: TaskAgentHooks
  ) {
    super();
    this.id = id;
    this.state = state;
    this.storage = storage;
    this.memory = memory;
    this.config = config;
    this.hooks = hooks;

    // Initialize ToolManager
    this._toolManager = config.toolManager ?? new ToolManager();

    // Forward memory events to agent (with cleanup tracking)
    const storedHandler = (data: any) => this.emit('memory:stored', data);
    const limitWarningHandler = (data: any) => this.emit('memory:limit_warning', { utilization: data.utilizationPercent });

    memory.on('stored', storedHandler);
    memory.on('limit_warning', limitWarningHandler);

    // Track cleanup functions
    this.eventCleanupFunctions.push(() => memory.off('stored', storedHandler));
    this.eventCleanupFunctions.push(() => memory.off('limit_warning', limitWarningHandler));

    // Setup session if configured
    if (config.session) {
      this._sessionManager = new SessionManager({ storage: config.session.storage });

      if (config.session.id) {
        // Will be loaded asynchronously in start()
      } else {
        // Create new session
        this._session = this._sessionManager.create('task-agent', {
          title: `TaskAgent ${id}`,
        });
      }
    }
  }

  /**
   * Create a new TaskAgent
   */
  static create(config: TaskAgentConfig): TaskAgent {
    // Resolve connector
    const connector =
      typeof config.connector === 'string' ? Connector.get(config.connector) : config.connector;

    if (!connector) {
      throw new Error(`Connector "${config.connector}" not found`);
    }

    // Create storage
    const storage = config.storage ?? createAgentStorage({});

    // Create working memory
    const memoryConfig = config.memoryConfig ?? DEFAULT_MEMORY_CONFIG;
    const memory = new WorkingMemory(storage.memory, memoryConfig);

    // Generate agent ID
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create empty initial plan (will be set on start)
    const emptyPlan = createPlan({ goal: '', tasks: [] });

    const agentConfig = {
      connectorName: typeof config.connector === 'string' ? config.connector : connector.name,
      model: config.model,
      temperature: config.temperature,
      maxIterations: config.maxIterations,
      toolNames: (config.tools ?? []).map((t) => t.definition.function.name),
    };

    const state = createAgentState(id, agentConfig, emptyPlan);

    const taskAgent = new TaskAgent(id, state, storage, memory, config, config.hooks);

    // Initialize components
    taskAgent.initializeComponents(config);

    return taskAgent;
  }

  /**
   * Wrap a tool with idempotency cache and enhanced context
   */
  private wrapToolWithCache(tool: ToolFunction): ToolFunction {
    return {
      ...tool,
      execute: async (args: any, context?: any) => {
        // Enhance context with contextManager and idempotencyCache
        const enhancedContext = {
          ...context,
          contextManager: this.contextManager,
          idempotencyCache: this.idempotencyCache,
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
    this._tools = [...(config.tools ?? []), ...memoryTools, ...contextTools];

    // Register tools with ToolManager
    for (const tool of this._tools) {
      this._toolManager.register(tool);
    }

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
    const contextTokens = modelInfo?.features.input.tokens ?? 128000;

    // Create context manager
    this.contextManager = new ContextManager(
      {
        ...DEFAULT_CONTEXT_CONFIG,
        maxContextTokens: contextTokens,
      },
      DEFAULT_COMPACTION_STRATEGY
    );

    // Note: idempotencyCache already created above for tool wrapping

    // Create history manager
    this.historyManager = new HistoryManager(DEFAULT_HISTORY_CONFIG);

    // Create external dependency handler
    this.externalHandler = new ExternalDependencyHandler(this._tools);

    // Create checkpoint manager
    this.checkpointManager = new CheckpointManager(this.storage, DEFAULT_CHECKPOINT_STRATEGY);

    // Create plan executor
    this.planExecutor = new PlanExecutor(
      this.agent,
      this.memory,
      this.contextManager,
      this.idempotencyCache,
      this.historyManager,
      this.externalHandler,
      this.checkpointManager,
      this.hooks,
      {
        maxIterations: config.maxIterations ?? 100,
      }
    );

    // Forward events from plan executor to task agent (with cleanup tracking)
    const taskStartHandler = (data: any) => this.emit('task:start', data);
    const taskCompleteHandler = (data: any) => {
      this.emit('task:complete', { task: data.task, result: { success: true, output: data.result } });
      // Call afterTask hook
      if (this.hooks?.afterTask) {
        this.hooks.afterTask(data.task, { success: true, output: data.result });
      }
    };
    const taskFailedHandler = (data: any) => this.emit('task:failed', data);
    const taskSkippedHandler = (data: any) => this.emit('task:failed', { task: data.task, error: new Error(data.reason) });
    const taskWaitingExternalHandler = (data: any) => this.emit('task:waiting', { task: data.task, dependency: data.task.externalDependency });
    const taskValidationFailedHandler = (data: any) => this.emit('task:validation_failed', data);

    this.planExecutor.on('task:start', taskStartHandler);
    this.planExecutor.on('task:complete', taskCompleteHandler);
    this.planExecutor.on('task:failed', taskFailedHandler);
    this.planExecutor.on('task:skipped', taskSkippedHandler);
    this.planExecutor.on('task:waiting_external', taskWaitingExternalHandler);
    this.planExecutor.on('task:validation_failed', taskValidationFailedHandler);
    this.planExecutor.on('task:validation_uncertain', taskValidationFailedHandler); // Reuse same handler for uncertain

    // Track cleanup functions
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:start', taskStartHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:complete', taskCompleteHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:failed', taskFailedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:skipped', taskSkippedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:waiting_external', taskWaitingExternalHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:validation_failed', taskValidationFailedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:validation_uncertain', taskValidationFailedHandler));
  }

  /**
   * Resume an existing agent from storage
   */
  static async resume(
    agentId: string,
    options: { storage: IAgentStorage; tools?: ToolFunction[]; hooks?: TaskAgentHooks }
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
    };

    // Create working memory from stored state
    const memory = new WorkingMemory(options.storage.memory, DEFAULT_MEMORY_CONFIG);

    const taskAgent = new TaskAgent(agentId, state, options.storage, memory, config, options.hooks);

    // Initialize components
    taskAgent.initializeComponents(config);

    return taskAgent;
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
    // TODO: Make this configurable for true background execution
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
      throw new Error('Session not enabled. Configure session in TaskAgentConfig to use this feature.');
    }

    // Update session state before saving
    this._session.toolState = this._toolManager.getState();

    // Serialize plan if exists
    if (this.state.plan) {
      this._session.plan = {
        version: 1,
        data: this.state.plan,
      };
    }

    // Serialize memory
    const memoryEntries = await this.memory.getIndex();
    this._session.memory = {
      version: 1,
      entries: memoryEntries.entries.map((e) => ({
        key: e.key,
        description: e.description,
        value: null, // Don't serialize full values, they're in storage
        scope: e.scope,
        sizeBytes: 0, // Size is stored as human-readable in index
        basePriority: e.effectivePriority, // Store computed priority
        pinned: e.pinned,
      })),
    };

    await this._sessionManager.save(this._session);
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

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Remove all event listeners first
    this.eventCleanupFunctions.forEach((cleanup) => cleanup());
    this.eventCleanupFunctions = [];

    // Cleanup session manager
    if (this._sessionManager) {
      if (this._session) {
        this._sessionManager.stopAutoSave(this._session.id);
      }
      this._sessionManager.destroy();
    }

    // Cleanup tool manager
    this._toolManager.removeAllListeners();

    // Cleanup components
    this.externalHandler?.cleanup();
    await this.checkpointManager?.cleanup();
    this.planExecutor?.cleanup();
    this.agent?.destroy();
  }
}
