/**
 * TaskAgent - autonomous task-based agent
 */

import EventEmitter from 'eventemitter3';
import { Connector } from '../../core/Connector.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { Plan, PlanInput, Task, TaskInput, createPlan, createTask } from '../../domain/entities/Task.js';
import { AgentState, AgentStatus, createAgentState, updateAgentStatus } from '../../domain/entities/AgentState.js';
import { WorkingMemoryConfig } from '../../domain/entities/Memory.js';
import { IAgentStorage, createAgentStorage } from '../../infrastructure/storage/InMemoryStorage.js';
import { WorkingMemory } from './WorkingMemory.js';

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

  protected constructor(
    id: string,
    state: AgentState,
    storage: IAgentStorage,
    memory: WorkingMemory,
    hooks?: TaskAgentHooks
  ) {
    super();
    this.id = id;
    this.state = state;
    this.storage = storage;
    this.memory = memory;
    this.hooks = hooks;

    // Forward memory events to agent
    memory.on('stored', (data) => this.emit('memory:stored', data));
    memory.on('limit_warning', (data) => this.emit('memory:limit_warning', { utilization: data.utilizationPercent }));
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
    const memory = new WorkingMemory(storage.memory, config.memoryConfig);

    // Generate agent ID
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create agent config for state

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

    return new TaskAgent(id, state, storage, memory, config.hooks);
  }

  /**
   * Resume an existing agent from storage
   */
  static async resume(
    agentId: string,
    options: { storage: IAgentStorage; tools?: ToolFunction[] }
  ): Promise<TaskAgent> {
    const state = await options.storage.agent.load(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not found in storage`);
    }

    // Create working memory from stored state
    const { DEFAULT_MEMORY_CONFIG } = await import('../../domain/entities/Memory.js');
    const memory = new WorkingMemory(options.storage.memory, DEFAULT_MEMORY_CONFIG);

    return new TaskAgent(agentId, state, options.storage, memory, undefined);
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

    // Basic execution loop (simplified for initial implementation)
    const completedTasks = plan.tasks.filter((t) => t.status === 'completed').length;
    const failedTasks = plan.tasks.filter((t) => t.status === 'failed').length;
    const skippedTasks = plan.tasks.filter((t) => t.status === 'skipped').length;

    const result: PlanResult = {
      status: 'completed',
      metrics: {
        totalTasks: plan.tasks.length,
        completedTasks,
        failedTasks,
        skippedTasks,
      },
    };

    this.emit('agent:completed', { result });

    return result;
  }
}
