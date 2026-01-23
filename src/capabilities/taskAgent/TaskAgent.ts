/**
 * TaskAgent - autonomous task-based agent
 */

import EventEmitter from 'eventemitter3';
import { Connector } from '../../core/Connector.js';
import { Agent } from '../../core/Agent.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { Plan, PlanInput, Task, TaskInput, createPlan, createTask } from '../../domain/entities/Task.js';
import { AgentState, AgentStatus, createAgentState, updateAgentStatus } from '../../domain/entities/AgentState.js';
import { WorkingMemoryConfig, DEFAULT_MEMORY_CONFIG } from '../../domain/entities/Memory.js';
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
 * Plan update options
 */
export interface PlanUpdates {
  addTasks?: TaskInput[];
  updateTasks?: Array<{ id: string } & Partial<Task>>;
  removeTasks?: string[];
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

  /** Storage for persistence */
  storage?: IAgentStorage;

  /** Memory configuration */
  memoryConfig?: WorkingMemoryConfig;

  /** Hooks for customization */
  hooks?: TaskAgentHooks;
}

/**
 * TaskAgent events
 */
export interface TaskAgentEvents {
  'task:start': { task: Task };
  'task:complete': { task: Task; result: TaskResult };
  'task:failed': { task: Task; error: Error };
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
  protected tools: ToolFunction[] = [];
  protected config: TaskAgentConfig;

  // Event listener cleanup tracking
  private eventCleanupFunctions: Array<() => void> = [];

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

    // Forward memory events to agent (with cleanup tracking)
    const storedHandler = (data: any) => this.emit('memory:stored', data);
    const limitWarningHandler = (data: any) => this.emit('memory:limit_warning', { utilization: data.utilizationPercent });

    memory.on('stored', storedHandler);
    memory.on('limit_warning', limitWarningHandler);

    // Track cleanup functions
    this.eventCleanupFunctions.push(() => memory.off('stored', storedHandler));
    this.eventCleanupFunctions.push(() => memory.off('limit_warning', limitWarningHandler));
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
    this.tools = [...(config.tools ?? []), ...memoryTools, ...contextTools];

    // Create idempotency cache first (needed for wrapping tools)
    this.idempotencyCache = new IdempotencyCache(DEFAULT_IDEMPOTENCY_CONFIG);

    // Wrap tools with cache for idempotency
    const cachedTools = this.tools.map((tool) => this.wrapToolWithCache(tool));

    // Create base Agent for LLM calls
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: cachedTools,
      instructions: config.instructions,
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 10,
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
    this.externalHandler = new ExternalDependencyHandler(this.tools);

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

    this.planExecutor.on('task:start', taskStartHandler);
    this.planExecutor.on('task:complete', taskCompleteHandler);
    this.planExecutor.on('task:failed', taskFailedHandler);
    this.planExecutor.on('task:skipped', taskSkippedHandler);
    this.planExecutor.on('task:waiting_external', taskWaitingExternalHandler);

    // Track cleanup functions
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:start', taskStartHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:complete', taskCompleteHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:failed', taskFailedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:skipped', taskSkippedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off('task:waiting_external', taskWaitingExternalHandler));
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
   * Update the plan
   */
  async updatePlan(updates: PlanUpdates): Promise<void> {
    const plan = this.state.plan;
    if (!plan) {
      throw new Error('No plan running');
    }

    if (!plan.allowDynamicTasks && (updates.addTasks || updates.removeTasks)) {
      throw new Error('Dynamic tasks are disabled for this plan');
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

    // Cleanup components
    this.externalHandler?.cleanup();
    await this.checkpointManager?.cleanup();
    this.planExecutor?.cleanup();
    this.agent?.destroy();
  }
}
