/**
 * PlanExecutor - executes plans with LLM integration
 */

import EventEmitter from 'eventemitter3';
import { Agent } from '../../core/Agent.js';
import { Plan, Task, updateTaskStatus, evaluateCondition, getNextExecutableTasks } from '../../domain/entities/Task.js';
import { AgentState } from '../../domain/entities/AgentState.js';
import { calculateCost } from '../../domain/entities/Model.js';
import { WorkingMemory } from './WorkingMemory.js';
import { ContextManager } from './ContextManager.js';
import { IdempotencyCache } from './IdempotencyCache.js';
import { HistoryManager } from './HistoryManager.js';
import { ExternalDependencyHandler } from './ExternalDependencyHandler.js';
import { CheckpointManager } from './CheckpointManager.js';
import type { TaskAgentHooks, TaskContext, ErrorContext } from './TaskAgent.js';

export interface PlanExecutorConfig {
  maxIterations: number;
  taskTimeout?: number;
}

export interface PlanExecutorEvents {
  'task:start': { task: Task };
  'task:complete': { task: Task; result: any };
  'task:failed': { task: Task; error: Error };
  'task:skipped': { task: Task; reason: string };
  'task:waiting_external': { task: Task };
  'llm:call': { iteration: number };
  'tool:call': { toolName: string; args: any };
  'tool:result': { toolName: string; result: any };
}

export interface PlanExecutionResult {
  status: 'completed' | 'failed' | 'suspended';
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  error?: Error;
  metrics: {
    totalLLMCalls: number;
    totalToolCalls: number;
    totalTokensUsed: number;
    totalCost: number;
  };
}

/**
 * Executes a plan using LLM and tools
 */
export class PlanExecutor extends EventEmitter<PlanExecutorEvents> {
  private agent: Agent;
  private memory: WorkingMemory;
  private contextManager: ContextManager;
  private idempotencyCache: IdempotencyCache; // TODO: Integrate in tool execution (Task #4)
  private historyManager: HistoryManager;
  private externalHandler: ExternalDependencyHandler;
  private checkpointManager: CheckpointManager;
  private hooks: TaskAgentHooks | undefined;
  private config: PlanExecutorConfig;
  private abortController: AbortController;

  // Current execution metrics
  private currentMetrics = {
    totalLLMCalls: 0,
    totalToolCalls: 0,
    totalTokensUsed: 0,
    totalCost: 0,
  };

  // Reference to current agent state (for checkpointing)
  private currentState: AgentState | null = null;

  constructor(
    agent: Agent,
    memory: WorkingMemory,
    contextManager: ContextManager,
    idempotencyCache: IdempotencyCache,
    historyManager: HistoryManager,
    externalHandler: ExternalDependencyHandler,
    checkpointManager: CheckpointManager,
    hooks: TaskAgentHooks | undefined,
    config: PlanExecutorConfig
  ) {
    super();
    this.agent = agent;
    this.memory = memory;
    this.contextManager = contextManager;
    this.idempotencyCache = idempotencyCache;
    this.historyManager = historyManager;
    this.externalHandler = externalHandler;
    this.checkpointManager = checkpointManager;
    this.hooks = hooks;
    this.config = config;
    this.abortController = new AbortController();
  }

  /**
   * Execute a plan
   */
  async execute(plan: Plan, state: AgentState): Promise<PlanExecutionResult> {
    // Store state reference for checkpointing
    this.currentState = state;

    // Reset metrics for this execution
    this.currentMetrics = {
      totalLLMCalls: 0,
      totalToolCalls: 0,
      totalTokensUsed: 0,
      totalCost: 0,
    };

    let iteration = 0;

    while (iteration < this.config.maxIterations) {
      iteration++;

      // Check if plan is complete
      if (this.isPlanComplete(plan)) {
        break;
      }

      // Check if plan is suspended (waiting on external)
      if (this.isPlanSuspended(plan)) {
        return {
          status: 'suspended',
          completedTasks: plan.tasks.filter((t) => t.status === 'completed').length,
          failedTasks: plan.tasks.filter((t) => t.status === 'failed').length,
          skippedTasks: plan.tasks.filter((t) => t.status === 'skipped').length,
          metrics: this.currentMetrics,
        };
      }

      // Get next executable tasks
      const nextTasks = getNextExecutableTasks(plan);

      if (nextTasks.length === 0) {
        // No executable tasks - either waiting on dependencies or complete
        break;
      }

      // Execute tasks (parallel if configured)
      await Promise.all(
        nextTasks.map((task) => this.executeTask(plan, task))
      );
    }

    // Determine final status
    const hasFailures = plan.tasks.some((t) => t.status === 'failed');
    const allComplete = plan.tasks.every((t) =>
      ['completed', 'skipped', 'failed'].includes(t.status)
    );

    return {
      status: hasFailures ? 'failed' : allComplete ? 'completed' : 'suspended',
      completedTasks: plan.tasks.filter((t) => t.status === 'completed').length,
      failedTasks: plan.tasks.filter((t) => t.status === 'failed').length,
      skippedTasks: plan.tasks.filter((t) => t.status === 'skipped').length,
      metrics: this.currentMetrics,
    };
  }

  /**
   * Execute a single task
   */
  private async executeTask(plan: Plan, task: Task): Promise<void> {
    // Check condition if present
    if (task.condition) {
      const conditionMet = await evaluateCondition(task.condition, {
        get: (key: string) => this.memory.retrieve(key),
      });

      if (!conditionMet) {
        if (task.condition.onFalse === 'skip') {
          task.status = 'skipped';
          this.emit('task:skipped', { task, reason: 'condition_not_met' });
          return;
        } else if (task.condition.onFalse === 'fail') {
          task.status = 'failed';
          task.result = { success: false, error: 'Condition not met' };
          this.emit('task:failed', { task, error: new Error('Condition not met') });
          return;
        }
        // 'wait' - skip for now, will retry later
        return;
      }
    }

    // Call beforeTask hook
    if (this.hooks?.beforeTask) {
      const taskContext: TaskContext = {
        taskId: task.id,
        taskName: task.name,
        attempt: task.attempts + 1,
      };
      const hookResult = await this.hooks.beforeTask(task, taskContext);
      if (hookResult === 'skip') {
        task.status = 'skipped';
        this.emit('task:skipped', { task, reason: 'hook_skip' });
        return;
      }
    }

    // Mark task as in progress
    const updatedTask = updateTaskStatus(task, 'in_progress');
    Object.assign(task, updatedTask);
    this.emit('task:start', { task });

    try {
      // Build task prompt
      const taskPrompt = this.buildTaskPrompt(plan, task);

      // Prepare context (check for compaction needs)
      await this.contextManager.prepareContext(
        {
          systemPrompt: this.buildSystemPrompt(plan),
          instructions: '',
          memoryIndex: await this.memory.formatIndex(),
          conversationHistory: this.historyManager.getRecentMessages().map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentInput: taskPrompt,
        },
        this.memory as any,
        this.historyManager
      );

      // Add task prompt to history
      this.historyManager.addMessage('user', taskPrompt);

      this.emit('llm:call', { iteration: task.attempts });

      // Call beforeLLMCall hook
      let messages: any[] = [{ role: 'user', content: taskPrompt }];
      if (this.hooks?.beforeLLMCall) {
        messages = await this.hooks.beforeLLMCall(messages, {
          model: this.agent.model,
          temperature: 0.7, // Default temperature
        });
      }

      // Call LLM through the agent
      const response = await this.agent.run(taskPrompt);

      // Track metrics from response
      if (response.usage) {
        this.currentMetrics.totalLLMCalls++;
        this.currentMetrics.totalTokensUsed += response.usage.total_tokens || 0;

        // Calculate cost if model info available
        if (this.agent.model && response.usage.input_tokens && response.usage.output_tokens) {
          const cost = calculateCost(this.agent.model, response.usage.input_tokens, response.usage.output_tokens);
          if (cost !== null) {
            this.currentMetrics.totalCost += cost;
          }
        }
      }

      // Call afterLLMCall hook
      if (this.hooks?.afterLLMCall) {
        await this.hooks.afterLLMCall(response);
      }

      // Checkpoint after LLM call
      if (this.currentState) {
        await this.checkpointManager.onLLMCall(this.currentState);
      }

      // Add response to history
      this.historyManager.addMessage('assistant', response.output_text || '');

      // Mark task as complete
      const completedTask = updateTaskStatus(task, 'completed');
      completedTask.result = {
        success: true,
        output: response.output_text,
      };
      Object.assign(task, completedTask);

      this.emit('task:complete', { task, result: response });

      // Call afterTask hook
      if (this.hooks?.afterTask) {
        await this.hooks.afterTask(task, {
          success: true,
          output: response.output_text,
        });
      }

      // Check for external dependency
      if (task.externalDependency) {
        task.status = 'waiting_external';

        // Checkpoint before external wait
        if (this.currentState) {
          await this.checkpointManager.checkpoint(this.currentState, 'before_external_wait');
        }

        await this.externalHandler.startWaiting(task);
        this.emit('task:waiting_external', { task });
      }
    } catch (error) {
      // Handle task failure
      const err = error instanceof Error ? error : new Error(String(error));

      // Call onError hook
      let errorAction: 'retry' | 'fail' | 'skip' = 'retry';
      if (this.hooks?.onError) {
        const errorContext: ErrorContext = {
          task,
          error: err,
          phase: 'execution',
        };
        errorAction = await this.hooks.onError(err, errorContext);
      }

      if (errorAction === 'skip') {
        task.status = 'skipped';
        this.emit('task:skipped', { task, reason: 'error_hook_skip' });
        return;
      } else if (errorAction === 'fail') {
        // Force fail without retry
        const failedTask = updateTaskStatus(task, 'failed');
        failedTask.result = {
          success: false,
          error: err.message,
        };
        Object.assign(task, failedTask);
        this.emit('task:failed', { task, error: err });
        return;
      }

      // Check if we should retry (default behavior or 'retry' action)
      if (task.attempts < task.maxAttempts) {
        // Will retry on next iteration
        const retryTask = updateTaskStatus(task, 'pending');
        Object.assign(task, retryTask);
      } else {
        // Max attempts exceeded
        const failedTask = updateTaskStatus(task, 'failed');
        failedTask.result = {
          success: false,
          error: err.message,
        };
        Object.assign(task, failedTask);
        this.emit('task:failed', { task, error: err });
      }
    }
  }

  /**
   * Build system prompt for task execution
   */
  private buildSystemPrompt(plan: Plan): string {
    return `You are an autonomous agent executing a plan.

**Goal:** ${plan.goal}
${plan.context ? `**Context:** ${plan.context}\n` : ''}
**Your Role:** Execute tasks step by step using the available tools. Use working memory to store and retrieve information between tasks.

**Important Instructions:**
1. When you complete a task successfully, acknowledge it clearly
2. Use memory_store to save important data for future tasks
3. Use memory_retrieve to access previously stored data
4. If a task requires information from a previous task, retrieve it from memory
5. Be systematic and thorough in completing each task`;
  }

  /**
   * Build prompt for a specific task
   */
  private buildTaskPrompt(plan: Plan, task: Task): string {
    const prompt: string[] = [];

    prompt.push(`## Current Task: ${task.name}`);
    prompt.push('');
    prompt.push(`**Description:** ${task.description}`);

    if (task.expectedOutput) {
      prompt.push(`**Expected Output:** ${task.expectedOutput}`);
    }

    if (task.dependsOn.length > 0) {
      const deps = plan.tasks
        .filter((t) => task.dependsOn.includes(t.id))
        .map((t) => t.name);
      prompt.push(`**Dependencies Completed:** ${deps.join(', ')}`);
    }

    prompt.push('');
    prompt.push('Please complete this task using the available tools.');

    return prompt.join('\n');
  }

  /**
   * Check if plan is complete
   */
  private isPlanComplete(plan: Plan): boolean {
    return plan.tasks.every((t) => ['completed', 'skipped', 'failed'].includes(t.status));
  }

  /**
   * Check if plan is suspended (waiting on external)
   */
  private isPlanSuspended(plan: Plan): boolean {
    return plan.tasks.some((t) => t.status === 'waiting_external');
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    this.abortController.abort();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.abortController.abort();
  }

  /**
   * Get idempotency cache (for future tool execution integration)
   *
   * TODO: Full IdempotencyCache Integration
   * ----------------------------------------
   * To fully integrate idempotency caching:
   *
   * Option 1: Wrap Agent.run() with tool interception
   * - Intercept tool calls before Agent.run()
   * - Check cache with: await this.idempotencyCache.get(tool, args)
   * - If cached, inject result into LLM context
   * - After execution: await this.idempotencyCache.set(tool, args, result)
   *
   * Option 2: Modify Agent class to accept IdempotencyCache
   * - Pass idempotencyCache to Agent constructor
   * - Agent integrates with ToolExecutor
   * - Automatic caching for all tool calls
   *
   * Option 3: Create ToolContext wrapper
   * - Wrap tools with context (agentId, taskId, memory)
   * - Cache-aware tool execution
   * - Auto-store large outputs in memory
   */
  getIdempotencyCache(): IdempotencyCache {
    return this.idempotencyCache;
  }
}
