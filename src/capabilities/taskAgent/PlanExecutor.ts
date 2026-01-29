/**
 * PlanExecutor - executes plans with LLM integration
 *
 * Uses unified AgentContext for context management.
 */

import { EventEmitter } from 'eventemitter3';
import { Agent } from '../../core/Agent.js';
import { Plan, Task, TaskValidationResult, updateTaskStatus, evaluateCondition, getNextExecutableTasks } from '../../domain/entities/Task.js';
import type { StaleEntryInfo, TaskStatusForMemory } from '../../domain/entities/Memory.js';
import { AgentState } from '../../domain/entities/AgentState.js';
import { calculateCost } from '../../domain/entities/Model.js';
import { TaskTimeoutError, TaskValidationError, ParallelTasksError, TaskFailure } from '../../domain/errors/AIErrors.js';
import { TokenBucketRateLimiter } from '../../infrastructure/resilience/index.js';
import { WorkingMemory } from './WorkingMemory.js';
import { AgentContext } from '../../core/AgentContext.js';
import { PlanPlugin } from '../../core/context/plugins/PlanPlugin.js';
import { IdempotencyCache } from './IdempotencyCache.js';
import { ExternalDependencyHandler } from './ExternalDependencyHandler.js';
import { CheckpointManager } from './CheckpointManager.js';
import type { TaskAgentHooks, TaskContext, ErrorContext } from './TaskAgent.js';
import { extractJSON, extractNumber } from '../../utils/jsonExtractor.js';
import { TASK_DEFAULTS } from '../../core/constants.js';

/** Default task timeout (from centralized constants) */
const DEFAULT_TASK_TIMEOUT_MS = TASK_DEFAULTS.TIMEOUT_MS;

export interface PlanExecutorConfig {
  maxIterations: number;
  taskTimeout?: number;

  /** Rate limiting configuration for LLM calls */
  rateLimiter?: {
    /** Max requests per minute (default: 60) */
    maxRequestsPerMinute?: number;
    /** What to do when rate limited: 'wait' or 'throw' (default: 'wait') */
    onLimit?: 'wait' | 'throw';
    /** Max wait time in ms (for 'wait' mode, default: 60000) */
    maxWaitMs?: number;
  };
}

export interface PlanExecutorEvents {
  'task:start': { task: Task };
  'task:complete': { task: Task; result: any };
  'task:failed': { task: Task; error: Error };
  'task:skipped': { task: Task; reason: string };
  'task:timeout': { task: Task; timeoutMs: number };
  'task:validation_failed': { task: Task; validation: TaskValidationResult };
  'task:validation_uncertain': { task: Task; validation: TaskValidationResult };
  'task:waiting_external': { task: Task };
  'memory:stale_entries': { entries: StaleEntryInfo[]; taskId: string };
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
  private agentContext: AgentContext;
  private planPlugin: PlanPlugin;
  private idempotencyCache: IdempotencyCache;
  private externalHandler: ExternalDependencyHandler;
  private checkpointManager: CheckpointManager;
  private hooks: TaskAgentHooks | undefined;
  private config: PlanExecutorConfig;
  private abortController: AbortController;
  private rateLimiter?: TokenBucketRateLimiter;

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
    agentContext: AgentContext,
    planPlugin: PlanPlugin,
    idempotencyCache: IdempotencyCache,
    externalHandler: ExternalDependencyHandler,
    checkpointManager: CheckpointManager,
    hooks: TaskAgentHooks | undefined,
    config: PlanExecutorConfig
  ) {
    super();
    this.agent = agent;
    this.memory = memory;
    this.agentContext = agentContext;
    this.planPlugin = planPlugin;
    this.idempotencyCache = idempotencyCache;
    this.externalHandler = externalHandler;
    this.checkpointManager = checkpointManager;
    this.hooks = hooks;
    this.config = config;
    this.abortController = new AbortController();

    // Initialize rate limiter if configured
    if (config.rateLimiter) {
      this.rateLimiter = new TokenBucketRateLimiter({
        maxRequests: config.rateLimiter.maxRequestsPerMinute ?? 60,
        windowMs: 60000, // 1 minute window
        onLimit: config.rateLimiter.onLimit ?? 'wait',
        maxWaitMs: config.rateLimiter.maxWaitMs ?? 60000,
      });
    }
  }

  /**
   * Build a map of task states for memory priority calculation
   */
  private buildTaskStatesMap(plan: Plan): Map<string, TaskStatusForMemory> {
    const taskStates = new Map<string, TaskStatusForMemory>();
    for (const task of plan.tasks) {
      // Map TaskStatus to TaskStatusForMemory (they're compatible for terminal states)
      const status = task.status as TaskStatusForMemory;
      if (['pending', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled'].includes(status)) {
        taskStates.set(task.id, status);
      } else {
        // Map other statuses to pending for memory priority purposes
        taskStates.set(task.id, 'pending');
      }
    }
    return taskStates;
  }

  /**
   * Notify memory about task completion and detect stale entries
   */
  private async notifyMemoryOfTaskCompletion(plan: Plan, taskId: string): Promise<void> {
    const taskStates = this.buildTaskStatesMap(plan);
    const staleEntries = await this.memory.onTaskComplete(taskId, taskStates);

    if (staleEntries.length > 0) {
      this.emit('memory:stale_entries', { entries: staleEntries, taskId });
    }
  }

  /**
   * Execute a plan
   */
  async execute(plan: Plan, state: AgentState): Promise<PlanExecutionResult> {
    // Store state reference for checkpointing
    this.currentState = state;

    // Update checkpoint manager with current state
    this.checkpointManager.setCurrentState(state);

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
      await this.executeParallelTasks(plan, nextTasks);
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
   * Execute tasks in parallel with configurable failure handling
   *
   * Note on failure modes:
   * - 'fail-fast' (default): Uses Promise.all - stops batch on first rejection (current behavior)
   *   Individual task failures don't reject, they just set task.status = 'failed'
   * - 'continue': Uses Promise.allSettled - all tasks run regardless of failures
   * - 'fail-all': Uses Promise.allSettled, then throws ParallelTasksError if any failed
   *
   * @param plan - The plan being executed
   * @param tasks - Tasks to execute in parallel
   * @returns Result containing succeeded and failed tasks
   */
  private async executeParallelTasks(
    plan: Plan,
    tasks: Task[]
  ): Promise<{ succeeded: Task[]; failed: TaskFailure[] }> {
    const failureMode = plan.concurrency?.failureMode ?? 'fail-fast';
    const succeeded: Task[] = [];
    const failed: TaskFailure[] = [];

    if (failureMode === 'fail-fast') {
      // Original behavior - Promise.all executes in parallel
      // Individual executeTask() calls handle errors internally (set task.status)
      // Promise.all only rejects if executeTask throws (which it doesn't for normal failures)
      await Promise.all(tasks.map((task) => this.executeTask(plan, task)));

      // Categorize results
      for (const task of tasks) {
        if (task.status === 'completed') {
          succeeded.push(task);
        } else if (task.status === 'failed') {
          const errorMsg = typeof task.result?.error === 'string' ? task.result.error : 'Task failed';
          failed.push({
            taskId: task.id,
            taskName: task.name,
            error: new Error(errorMsg),
          });
        }
      }

      return { succeeded, failed };
    }

    // Use Promise.allSettled for 'continue' and 'fail-all' modes
    // Execute all tasks in parallel, don't stop on failures
    await Promise.allSettled(
      tasks.map(async (task) => {
        await this.executeTask(plan, task);
      })
    );

    // Categorize results based on task status
    for (const task of tasks) {
      if (task.status === 'completed') {
        succeeded.push(task);
      } else if (task.status === 'failed') {
        const errorMsg = typeof task.result?.error === 'string' ? task.result.error : 'Task failed';
        failed.push({
          taskId: task.id,
          taskName: task.name,
          error: new Error(errorMsg),
        });
      }
      // 'pending', 'skipped', 'in_progress' are not categorized as succeeded or failed
    }

    // For 'fail-all' mode, throw aggregate error if any failed
    if (failureMode === 'fail-all' && failed.length > 0) {
      throw new ParallelTasksError(failed);
    }

    // For 'continue' mode, we just return the results and continue execution
    return { succeeded, failed };
  }

  /**
   * Check if task condition is met
   * @returns true if condition is met or no condition exists
   */
  private async checkCondition(task: Task): Promise<boolean> {
    if (!task.condition) {
      return true;
    }
    return evaluateCondition(task.condition, {
      get: (key: string) => this.memory.retrieve(key),
    });
  }

  /**
   * Get the timeout for a task (per-task override or config default)
   */
  private getTaskTimeout(task: Task): number {
    // Check for per-task override in metadata
    const perTaskTimeout = task.metadata?.timeoutMs;
    if (typeof perTaskTimeout === 'number' && perTaskTimeout > 0) {
      return perTaskTimeout;
    }
    // Use config timeout or default
    return this.config.taskTimeout ?? DEFAULT_TASK_TIMEOUT_MS;
  }

  /**
   * Execute a single task with timeout support
   */
  private async executeTask(plan: Plan, task: Task): Promise<void> {
    // Initial condition check (before timeout wrapper - fast check)
    if (task.condition) {
      const conditionMet = await this.checkCondition(task);

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

    // Call beforeTask hook (before timeout wrapper - user control)
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

    // Get timeout for this task
    const timeoutMs = this.getTaskTimeout(task);

    try {
      // Execute task with timeout
      await this.executeTaskWithTimeout(plan, task, timeoutMs);
    } catch (error) {
      // Check if this is a timeout error
      if (error instanceof TaskTimeoutError) {
        this.emit('task:timeout', { task, timeoutMs });
        // Timeout errors still go through error handling (may retry)
      }

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
   * Execute task core logic with timeout
   */
  private async executeTaskWithTimeout(plan: Plan, task: Task, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Setup timeout
      const timeoutId = setTimeout(() => {
        reject(new TaskTimeoutError(task.id, task.name, timeoutMs));
      }, timeoutMs);

      // Execute the task core logic
      this.executeTaskCore(plan, task)
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Core task execution logic (called by executeTaskWithTimeout)
   */
  private async executeTaskCore(plan: Plan, task: Task): Promise<void> {
    // Build task prompt
    const taskPrompt = this.buildTaskPrompt(plan, task);

    // Update context with current input and plan state
    this.planPlugin.setPlan(plan);
    this.agentContext.setCurrentInput(taskPrompt);

    // Prepare context using unified AgentContext (handles compaction automatically)
    await this.agentContext.prepare();

    // Add task prompt to history
    this.agentContext.addMessage('user', taskPrompt);

    this.emit('llm:call', { iteration: task.attempts });

    // Call beforeLLMCall hook
    let messages: any[] = [{ role: 'user', content: taskPrompt }];
    if (this.hooks?.beforeLLMCall) {
      messages = await this.hooks.beforeLLMCall(messages, {
        model: this.agent.model,
        temperature: 0.7, // Default temperature
      });
    }

    // Re-check condition immediately before LLM call (race condition protection)
    // This prevents stale condition evaluation when parallel tasks modify memory
    const raceProtection = task.execution?.raceProtection !== false; // Default to true
    if (task.condition && raceProtection) {
      const stillMet = await this.checkCondition(task);
      if (!stillMet) {
        // Condition changed - skip task to avoid wasted LLM call
        task.status = 'skipped';
        this.emit('task:skipped', { task, reason: 'condition_changed' });
        return;
      }
    }

    // Apply rate limiting if configured (before LLM call to prevent overloading provider)
    if (this.rateLimiter) {
      await this.rateLimiter.acquire();
    }

    // Call LLM through the agent (tools already wrapped with cache in TaskAgent)
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

    // Track tool calls from Agent's execution metrics (more accurate than parsing response)
    const agentMetrics = this.agent.getMetrics();
    if (agentMetrics) {
      this.currentMetrics.totalToolCalls += agentMetrics.toolCallCount;
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
    this.agentContext.addMessage('assistant', response.output_text || '');

    // Validate task completion (unless validation is disabled or not configured)
    const validationResult = await this.validateTaskCompletion(task, response.output_text || '');

    // Store validation result in task metadata
    task.metadata = task.metadata || {};
    task.metadata.validationResult = validationResult;

    // Handle validation result
    if (validationResult.requiresUserApproval) {
      // Emit event for user decision - task stays in progress
      this.emit('task:validation_uncertain', { task, validation: validationResult });

      // If mode is 'strict', wait for user approval (task remains in_progress)
      // The user can complete the task manually via completeTaskManually()
      if (task.validation?.mode === 'strict') {
        return; // Don't complete, wait for user input
      }
    }

    if (!validationResult.isComplete) {
      // Validation failed
      if (task.validation?.mode === 'strict') {
        // In strict mode, fail the task
        this.emit('task:validation_failed', { task, validation: validationResult });
        throw new TaskValidationError(
          task.id,
          task.name,
          `Completion score ${validationResult.completionScore}% below threshold. ${validationResult.explanation}`
        );
      } else {
        // In warn mode (default), log warning but complete the task
        this.emit('task:validation_failed', { task, validation: validationResult });
        // Continue to mark as complete with warning
      }
    }

    // Mark task as complete
    const completedTask = updateTaskStatus(task, 'completed');
    completedTask.result = {
      success: true,
      output: response.output_text,
      validationScore: validationResult.completionScore,
      validationExplanation: validationResult.explanation,
    };
    Object.assign(task, completedTask);

    this.emit('task:complete', { task, result: response });

    // Notify memory of task completion to detect stale entries
    await this.notifyMemoryOfTaskCompletion(plan, task.id);

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
   * Validate task completion using LLM self-reflection or custom hook
   *
   * @param task - The task to validate
   * @param output - The LLM response output
   * @returns TaskValidationResult with completion score and details
   */
  private async validateTaskCompletion(
    task: Task,
    output: string
  ): Promise<TaskValidationResult> {
    // If task has no validation config and skipReflection is not explicitly false,
    // default to successful completion (backward compatibility)
    if (!task.validation || task.validation.skipReflection) {
      return {
        isComplete: true,
        completionScore: 100,
        explanation: 'No validation configured, task marked complete',
        requiresUserApproval: false,
      };
    }

    // First, check if a custom validateTask hook is provided
    if (this.hooks?.validateTask) {
      const taskResult = { success: true, output };
      const hookResult = await this.hooks.validateTask(task, taskResult, this.memory);

      // Handle different return types from hook
      if (typeof hookResult === 'boolean') {
        return {
          isComplete: hookResult,
          completionScore: hookResult ? 100 : 0,
          explanation: hookResult ? 'Validated by custom hook' : 'Rejected by custom hook',
          requiresUserApproval: false,
        };
      } else if (typeof hookResult === 'string') {
        return {
          isComplete: false,
          completionScore: 0,
          explanation: hookResult,
          requiresUserApproval: false,
        };
      } else {
        // Full TaskValidationResult
        return hookResult;
      }
    }

    // Check required memory keys if specified
    if (task.validation.requiredMemoryKeys && task.validation.requiredMemoryKeys.length > 0) {
      const missingKeys: string[] = [];
      for (const key of task.validation.requiredMemoryKeys) {
        const value = await this.memory.retrieve(key);
        if (value === undefined) {
          missingKeys.push(key);
        }
      }
      if (missingKeys.length > 0) {
        return {
          isComplete: false,
          completionScore: 0,
          explanation: `Required memory keys not found: ${missingKeys.join(', ')}`,
          requiresUserApproval: false,
        };
      }
    }

    // If no completion criteria, skip LLM validation
    if (!task.validation.completionCriteria || task.validation.completionCriteria.length === 0) {
      return {
        isComplete: true,
        completionScore: 100,
        explanation: 'No completion criteria specified, task marked complete',
        requiresUserApproval: false,
      };
    }

    // Use LLM self-reflection to validate task completion
    const validationPrompt = this.buildValidationPrompt(task, output);

    // Call LLM for validation (separate call from task execution)
    this.emit('llm:call', { iteration: task.attempts });
    const validationResponse = await this.agent.run(validationPrompt);

    // Track metrics
    if (validationResponse.usage) {
      this.currentMetrics.totalLLMCalls++;
      this.currentMetrics.totalTokensUsed += validationResponse.usage.total_tokens || 0;

      if (this.agent.model && validationResponse.usage.input_tokens && validationResponse.usage.output_tokens) {
        const cost = calculateCost(
          this.agent.model,
          validationResponse.usage.input_tokens,
          validationResponse.usage.output_tokens
        );
        if (cost !== null) {
          this.currentMetrics.totalCost += cost;
        }
      }
    }

    // Track tool calls from validation (typically 0, but track for consistency)
    const validationAgentMetrics = this.agent.getMetrics();
    if (validationAgentMetrics) {
      this.currentMetrics.totalToolCalls += validationAgentMetrics.toolCallCount;
    }

    // Parse validation response
    return this.parseValidationResponse(
      task,
      validationResponse.output_text || ''
    );
  }

  /**
   * Build prompt for LLM self-reflection validation
   */
  private buildValidationPrompt(task: Task, output: string): string {
    const criteria = task.validation?.completionCriteria || [];
    const minScore = task.validation?.minCompletionScore ?? 80;

    return `You are a task completion validator. Your job is to evaluate whether a task was completed successfully.

## Task Information
**Task Name:** ${task.name}
**Task Description:** ${task.description}
${task.expectedOutput ? `**Expected Output:** ${task.expectedOutput}` : ''}

## Completion Criteria
The task is considered complete if it meets these criteria:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Task Output
The following was the output from executing the task:
---
${output}
---

## Your Evaluation
Please evaluate the task completion and respond in the following JSON format:
\`\`\`json
{
  "completionScore": <number 0-100>,
  "isComplete": <true if score >= ${minScore}>,
  "explanation": "<brief explanation of your evaluation>",
  "criteriaResults": [
    {
      "criterion": "<criterion text>",
      "met": <true/false>,
      "evidence": "<brief evidence from output>"
    }
  ]
}
\`\`\`

Be honest and thorough in your evaluation. A score of 100 means all criteria are fully met. A score below ${minScore} means the task needs more work.`;
  }

  /**
   * Parse LLM validation response into TaskValidationResult
   */
  private parseValidationResponse(
    task: Task,
    responseText: string
  ): TaskValidationResult {
    const minScore = task.validation?.minCompletionScore ?? 80;
    const requireApproval = task.validation?.requireUserApproval ?? 'never';

    // Use extractJSON utility to handle markdown code blocks and inline JSON
    interface ValidationResponse {
      completionScore?: number;
      isComplete?: boolean;
      explanation?: string;
      criteriaResults?: Array<{
        criterion: string;
        met: boolean;
        evidence?: string;
      }>;
    }

    const extractionResult = extractJSON<ValidationResponse>(responseText);

    if (extractionResult.success && extractionResult.data) {
      const parsed = extractionResult.data;

      const completionScore = typeof parsed.completionScore === 'number'
        ? Math.max(0, Math.min(100, parsed.completionScore))
        : 0;

      const isComplete = completionScore >= minScore;

      // Determine if user approval is needed
      let requiresUserApproval = false;
      let approvalReason: string | undefined;

      if (requireApproval === 'always') {
        requiresUserApproval = true;
        approvalReason = 'User approval required for all task completions';
      } else if (requireApproval === 'uncertain') {
        // Uncertain range: score is between 60% and minScore
        const uncertainThreshold = Math.max(minScore - 20, 50);
        if (completionScore >= uncertainThreshold && completionScore < minScore) {
          requiresUserApproval = true;
          approvalReason = `Completion score (${completionScore}%) is uncertain - below threshold but potentially acceptable`;
        }
      }

      return {
        isComplete,
        completionScore,
        explanation: parsed.explanation || 'No explanation provided',
        criteriaResults: parsed.criteriaResults,
        requiresUserApproval,
        approvalReason,
      };
    }

    // Failed to parse JSON - try to extract score from text using utility
    const score = extractNumber(responseText, [
      /(\d{1,3})%?\s*(?:complete|score)/i,
      /(?:score|completion|rating)[:\s]+(\d{1,3})/i,
    ], 50);

    return {
      isComplete: score >= minScore,
      completionScore: score,
      explanation: `Could not parse structured response. Estimated score: ${score}%`,
      requiresUserApproval: requireApproval === 'always' || requireApproval === 'uncertain',
      approvalReason: 'Could not parse validation response accurately',
    };
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
   * Get idempotency cache
   */
  getIdempotencyCache(): IdempotencyCache {
    return this.idempotencyCache;
  }

  /**
   * Get rate limiter metrics (if rate limiting is enabled)
   */
  getRateLimiterMetrics(): { totalRequests: number; throttledRequests: number; totalWaitMs: number; avgWaitMs: number } | null {
    if (!this.rateLimiter) {
      return null;
    }
    return this.rateLimiter.getMetrics();
  }

  /**
   * Reset rate limiter state (for testing or manual control)
   */
  resetRateLimiter(): void {
    this.rateLimiter?.reset();
  }
}
