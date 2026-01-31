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
 * Uses AgentContext with PlanPlugin and MemoryPlugin for unified
 * context management across all agent types.
 */

import { BaseAgent, BaseAgentConfig, BaseSessionConfig } from '../../core/BaseAgent.js';
import { Connector } from '../../core/Connector.js';
import { Agent } from '../../core/Agent.js';
import type { IContextStorage } from '../../domain/interfaces/IContextStorage.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { Plan, PlanInput, Task, TaskInput, TaskValidationResult, createPlan, createTask, detectDependencyCycle } from '../../domain/entities/Task.js';
import { DependencyCycleError } from '../../domain/errors/AIErrors.js';
import { AgentState, AgentStatus, createAgentState, updateAgentStatus } from '../../domain/entities/AgentState.js';
import type { WorkingMemoryConfig } from '../../domain/entities/Memory.js';
import { DEFAULT_MEMORY_CONFIG } from '../../domain/entities/Memory.js';
import { IAgentStorage, createAgentStorage } from '../../infrastructure/storage/InMemoryStorage.js';
import { WorkingMemory } from './WorkingMemory.js';
// Unified AgentContext (inherited from BaseAgent, import only for type reference if needed)
import { PlanPlugin } from '../../core/context/plugins/PlanPlugin.js';
import { MemoryPlugin } from '../../core/context/plugins/MemoryPlugin.js';
// NOTE: IdempotencyCache is accessed via this._agentContext.cache (single source of truth)
import { ExternalDependencyHandler } from './ExternalDependencyHandler.js';
import { PlanExecutor } from './PlanExecutor.js';
import { CheckpointManager, DEFAULT_CHECKPOINT_STRATEGY } from './CheckpointManager.js';
import { getModelInfo } from '../../domain/entities/Model.js';
import type { AgentPermissionsConfig } from '../../core/permissions/types.js';
import { CONTEXT_DEFAULTS } from '../../core/constants.js';

// NOTE: TaskAgent now exposes AgentContext directly via the `context` getter.
// TaskAgentContextAccess interface is deprecated - use AgentContext API instead.

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
  // NOTE: Memory is accessed via this._agentContext.memory (single source of truth)
  // The 'memory' getter below provides convenient access
  protected hooks?: TaskAgentHooks;
  protected executionPromise?: Promise<PlanResult>;

  // Internal components
  protected agent?: Agent;
  // Note: _agentContext is inherited from BaseAgent (single source of truth)
  // Cache is accessed via this._agentContext.cache (single source of truth)
  protected _planPlugin?: PlanPlugin;
  protected _memoryPlugin?: MemoryPlugin;
  protected externalHandler?: ExternalDependencyHandler;
  protected planExecutor?: PlanExecutor;
  protected checkpointManager?: CheckpointManager;
  protected _allTools: ToolFunction[] = [];

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

    // NOTE: WorkingMemory is created by AgentContext (single source of truth)
    // We pass memory config via the context config below
    const memoryConfig = config.memoryConfig ?? DEFAULT_MEMORY_CONFIG;

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

    // Create TaskAgent - memory config is passed to AgentContext via config.context
    const taskAgentConfig: TaskAgentConfig = {
      ...config,
      // Pass memory config to AgentContext
      context: {
        ...(typeof config.context === 'object' && config.context !== null && !(config.context instanceof Object.getPrototypeOf(config.context)?.constructor) ? config.context : {}),
        memory: {
          storage: agentStorage.memory,
          ...memoryConfig,
        },
      },
    };

    const taskAgent = new TaskAgent(id, state, agentStorage, taskAgentConfig, config.hooks);

    // Initialize components
    taskAgent.initializeComponents(taskAgentConfig);

    return taskAgent;
  }

  /**
   * Resume an existing agent from storage
   */
  static async resume(
    agentId: string,
    options: { storage: IAgentStorage; tools?: ToolFunction[]; hooks?: TaskAgentHooks; session?: { storage: IContextStorage } }
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

    // Recreate config from state - memory config is passed to AgentContext
    const config: TaskAgentConfig = {
      connector: state.config.connectorName,
      model: state.config.model,
      tools: options.tools ?? [],
      temperature: state.config.temperature,
      maxIterations: state.config.maxIterations,
      storage: options.storage,
      hooks: options.hooks,
      session: options.session,
      // Pass memory config to AgentContext (single source of truth)
      context: {
        memory: {
          storage: options.storage.memory,
          ...DEFAULT_MEMORY_CONFIG,
        },
      },
    };

    const taskAgent = new TaskAgent(agentId, state, options.storage, config, options.hooks);

    // Initialize components
    taskAgent.initializeComponents(config);

    return taskAgent;
  }

  // ===== Constructor =====

  protected constructor(
    id: string,
    state: AgentState,
    agentStorage: IAgentStorage,
    config: TaskAgentConfig,
    hooks?: TaskAgentHooks
  ) {
    // Call BaseAgent constructor - it handles connector resolution,
    // tool manager init, permission manager init, and AgentContext creation (including memory)
    super(config, 'TaskAgent');

    this.id = id;
    this.state = state;
    this.agentStorage = agentStorage;
    this.hooks = hooks;

    // Forward memory events to agent
    // Memory is accessed via this._agentContext.memory (single source of truth)
    // Only set up event handlers if memory feature is enabled
    const memory = this._agentContext.memory;
    if (memory) {
      memory.on('stored', (data: { key: string; description: string }) =>
        this.emit('memory:stored', data));
      memory.on('limit_warning', (data: { utilizationPercent: number }) =>
        this.emit('memory:limit_warning', { utilization: data.utilizationPercent }));
    }

    // Initialize session (from BaseAgent)
    this.initializeSession(config.session);
  }

  // ===== Abstract Method Implementations =====

  protected getAgentType(): 'agent' | 'task-agent' | 'universal-agent' {
    return 'task-agent';
  }

  // ===== Component Initialization =====

  /**
   * Initialize internal components
   */
  private initializeComponents(config: TaskAgentConfig): void {
    // User tools are already registered by BaseAgent constructor
    // Feature-aware tools (memory, cache, introspection) are auto-registered by AgentContext
    // This ensures consistent tool availability across ALL agent types
    this._allTools = [...(config.tools ?? [])];

    // NOTE: IdempotencyCache is accessed via this._agentContext.cache (single source of truth)
    // If memory feature is disabled, cache will be null

    // Get enabled tools from inherited AgentContext
    // Caching is now handled automatically by ToolManager.execute()
    const enabledTools = this._agentContext.tools.getEnabled();

    // Create base Agent for LLM calls (shares the inherited AgentContext)
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: enabledTools,
      instructions: config.instructions,
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 10,
      permissions: config.permissions,
      context: this._agentContext,  // Share inherited AgentContext
    });

    // Calculate context limit from model and update inherited AgentContext
    const modelInfo = getModelInfo(config.model);
    const contextTokens = modelInfo?.features.input.tokens ?? CONTEXT_DEFAULTS.MAX_TOKENS;
    this._agentContext.setMaxContextTokens(contextTokens);

    // Set system prompt on inherited AgentContext
    if (config.instructions) {
      this._agentContext.systemPrompt = config.instructions;
    }

    // Create plugins for the inherited AgentContext
    // NOTE: Memory is accessed via this._agentContext.memory (single source of truth)
    this._planPlugin = new PlanPlugin();
    this._agentContext.registerPlugin(this._planPlugin);

    // Only create MemoryPlugin if memory feature is enabled
    if (this._agentContext.memory) {
      this._memoryPlugin = new MemoryPlugin(this._agentContext.memory);
      this._agentContext.registerPlugin(this._memoryPlugin);
    }

    // Set initial plan in plugin
    this._planPlugin.setPlan(this.state.plan);

    // Create external dependency handler
    this.externalHandler = new ExternalDependencyHandler(this._allTools);

    // Create checkpoint manager
    this.checkpointManager = new CheckpointManager(this.agentStorage, DEFAULT_CHECKPOINT_STRATEGY);

    // Create plan executor with inherited AgentContext
    // NOTE: PlanExecutor gets memory and cache from AgentContext (single source of truth)
    this.planExecutor = new PlanExecutor(
      this.agent,
      this._agentContext,
      this._planPlugin,
      this.externalHandler,
      this.checkpointManager,
      this.hooks,
      {
        maxIterations: config.maxIterations ?? 100,
      }
    );

    // Forward events from plan executor to task agent
    this.setupPlanExecutorEvents();
  }

  /**
   * Setup event forwarding from PlanExecutor.
   * Cleanup is handled in destroy() via removeAllListeners().
   */
  private setupPlanExecutorEvents(): void {
    if (!this.planExecutor) return;

    this.planExecutor.on('task:start', (data: { task: Task }) =>
      this.emit('task:start', data));

    this.planExecutor.on('task:complete', (data: { task: Task; result: unknown }) => {
      this.emit('task:complete', { task: data.task, result: { success: true, output: data.result } });
      // Call afterTask hook
      if (this.hooks?.afterTask) {
        this.hooks.afterTask(data.task, { success: true, output: data.result });
      }
    });

    this.planExecutor.on('task:failed', (data: { task: Task; error: Error }) =>
      this.emit('task:failed', data));

    this.planExecutor.on('task:skipped', (data: { task: Task; reason: string }) =>
      this.emit('task:failed', { task: data.task, error: new Error(data.reason) }));

    this.planExecutor.on('task:waiting_external', (data: { task: Task }) =>
      this.emit('task:waiting', { task: data.task, dependency: data.task.externalDependency }));

    this.planExecutor.on('task:validation_failed', (data: { task: Task; validation: TaskValidationResult }) =>
      this.emit('task:validation_failed', data));

    this.planExecutor.on('task:validation_uncertain', (data: { task: Task; validation: TaskValidationResult }) =>
      this.emit('task:validation_failed', data));
  }

  // ===== Public API =====

  // ===== Unified Context Access =====

  // Note: `context` getter is inherited from BaseAgent (returns _agentContext)
  // The inherited getter returns the AgentContext which is always available after BaseAgent constructor

  /**
   * Check if context is available (components initialized).
   * Always true since AgentContext is created by BaseAgent constructor.
   */
  hasContext(): boolean {
    return true;
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
   * Get working memory (from AgentContext - single source of truth)
   * Returns null if memory feature is disabled
   */
  getMemory(): WorkingMemory | null {
    return this._agentContext.memory;
  }

  /**
   * Convenient getter for working memory (alias for _agentContext.memory)
   * Returns null if memory feature is disabled
   */
  get memory(): WorkingMemory | null {
    return this._agentContext.memory;
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

    // Cleanup composed EventEmitters via removeAllListeners()
    // This is simpler than tracking individual listeners
    this._agentContext.memory?.removeAllListeners();
    this.planExecutor?.removeAllListeners();

    // Cleanup components
    this.externalHandler?.cleanup();
    await this.checkpointManager?.cleanup();
    this.planExecutor?.destroy();
    this.agent?.destroy();

    // Run cleanup callbacks
    await this.runCleanupCallbacks();

    // Call base destroy (handles session, tool manager, permission manager cleanup)
    this.baseDestroy();

    this._logger.debug('TaskAgent destroyed');
  }
}
