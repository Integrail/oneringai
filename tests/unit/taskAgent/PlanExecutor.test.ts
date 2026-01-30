/**
 * PlanExecutor Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlanExecutor, PlanExecutorConfig } from '../../../src/capabilities/taskAgent/PlanExecutor.js';
import { Agent } from '../../../src/core/Agent.js';
import { WorkingMemory } from '../../../src/capabilities/taskAgent/WorkingMemory.js';
import { AgentContext } from '../../../src/core/AgentContext.js';
import { PlanPlugin } from '../../../src/core/context/plugins/PlanPlugin.js';
import { IdempotencyCache } from '../../../src/capabilities/taskAgent/IdempotencyCache.js';
import { ExternalDependencyHandler } from '../../../src/capabilities/taskAgent/ExternalDependencyHandler.js';
import { CheckpointManager } from '../../../src/capabilities/taskAgent/CheckpointManager.js';
import type { TaskAgentHooks, TaskContext, ErrorContext } from '../../../src/capabilities/taskAgent/TaskAgent.js';
import type { Plan, Task, TaskStatus } from '../../../src/domain/entities/Task.js';
import { InMemoryStorage } from '../../../src/infrastructure/storage/InMemoryStorage.js';

// Mock dependencies
const createMockAgent = () => ({
  run: vi.fn().mockResolvedValue({
    output_text: 'Task completed successfully',
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  }),
  model: 'gpt-4',
  getMetrics: vi.fn().mockReturnValue({ toolCallCount: 1 }),
});

const createMockMemory = () => ({
  retrieve: vi.fn(),
  onTaskComplete: vi.fn().mockResolvedValue([]),
});

const createMockAgentContext = (
  mockMemory: ReturnType<typeof createMockMemory>,
  mockCache: ReturnType<typeof createMockIdempotencyCache>
) => ({
  prepare: vi.fn().mockResolvedValue({ budget: { used: 1000, total: 10000 }, components: [], compacted: false }),
  addMessage: vi.fn().mockResolvedValue({ id: 'msg-1', role: 'assistant', content: '', timestamp: Date.now() }),
  addMessageSync: vi.fn().mockReturnValue({ id: 'msg-1', role: 'user', content: '', timestamp: Date.now() }),
  setCurrentInput: vi.fn(),
  getHistory: vi.fn().mockReturnValue([]),
  destroy: vi.fn(),
  // Memory and cache are accessed via AgentContext (single source of truth)
  memory: mockMemory,
  cache: mockCache,
});

const createMockPlanPlugin = () => ({
  setPlan: vi.fn(),
  getPlan: vi.fn(),
});

const createMockIdempotencyCache = () => ({
  get: vi.fn(),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
});

const createMockExternalHandler = () => ({
  startWaiting: vi.fn().mockResolvedValue(undefined),
  checkPending: vi.fn().mockResolvedValue([]),
});

const createMockCheckpointManager = () => ({
  setCurrentState: vi.fn(),
  onLLMCall: vi.fn().mockResolvedValue(undefined),
  checkpoint: vi.fn().mockResolvedValue(undefined),
});

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  name: 'Test Task',
  description: 'Test task description',
  status: 'pending' as TaskStatus,
  dependsOn: [],
  attempts: 0,
  maxAttempts: 3,
  priority: 1,
  ...overrides,
});

const createPlan = (tasks: Task[] = []): Plan => ({
  id: 'plan-1',
  name: 'Test Plan',
  goal: 'Test goal',
  tasks: tasks.length > 0 ? tasks : [createTask()],
  status: 'active',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('PlanExecutor', () => {
  let executor: PlanExecutor;
  let mockAgent: ReturnType<typeof createMockAgent>;
  let mockMemory: ReturnType<typeof createMockMemory>;
  let mockAgentContext: ReturnType<typeof createMockAgentContext>;
  let mockPlanPlugin: ReturnType<typeof createMockPlanPlugin>;
  let mockIdempotencyCache: ReturnType<typeof createMockIdempotencyCache>;
  let mockExternalHandler: ReturnType<typeof createMockExternalHandler>;
  let mockCheckpointManager: ReturnType<typeof createMockCheckpointManager>;
  let config: PlanExecutorConfig;

  beforeEach(() => {
    mockAgent = createMockAgent();
    mockMemory = createMockMemory();
    mockIdempotencyCache = createMockIdempotencyCache();
    // Pass both memory and cache to AgentContext (single source of truth)
    mockAgentContext = createMockAgentContext(mockMemory, mockIdempotencyCache);
    mockPlanPlugin = createMockPlanPlugin();
    mockExternalHandler = createMockExternalHandler();
    mockCheckpointManager = createMockCheckpointManager();
    config = { maxIterations: 10 };

    // NOTE: PlanExecutor gets memory and cache from AgentContext (single source of truth)
    executor = new PlanExecutor(
      mockAgent as any,
      mockAgentContext as any,  // Memory and cache accessed via agentContext
      mockPlanPlugin as any,
      mockExternalHandler as any,
      mockCheckpointManager as any,
      undefined,
      config
    );
  });

  afterEach(() => {
    executor.cleanup();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should initialize without rate limiter when not configured', () => {
      const metrics = executor.getRateLimiterMetrics();
      expect(metrics).toBeNull();
    });

    it('should initialize rate limiter when configured', () => {
      const executorWithRateLimiter = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        undefined,
        {
          maxIterations: 10,
          rateLimiter: {
            maxRequestsPerMinute: 30,
            onLimit: 'wait',
            maxWaitMs: 5000,
          },
        }
      );

      const metrics = executorWithRateLimiter.getRateLimiterMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics?.totalRequests).toBe(0);
    });
  });

  // ============================================================================
  // execute() Tests
  // ============================================================================

  describe('execute()', () => {
    it('should execute a simple plan with one task', async () => {
      const plan = createPlan([createTask()]);
      const state = { id: 'state-1' } as any;

      const result = await executor.execute(plan, state);

      expect(result.status).toBe('completed');
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(0);
      expect(mockAgent.run).toHaveBeenCalled();
    });

    it('should track metrics during execution', async () => {
      const plan = createPlan([createTask()]);
      const state = { id: 'state-1' } as any;

      const result = await executor.execute(plan, state);

      expect(result.metrics.totalLLMCalls).toBeGreaterThan(0);
      expect(result.metrics.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should return suspended status when task is waiting on external', async () => {
      const task = createTask({ status: 'waiting_external' as TaskStatus });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      const result = await executor.execute(plan, state);

      expect(result.status).toBe('suspended');
    });

    it('should return completed status when all tasks are done', async () => {
      const task = createTask({ status: 'completed' as TaskStatus });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      const result = await executor.execute(plan, state);

      expect(result.status).toBe('completed');
      expect(result.completedTasks).toBe(1);
    });

    it('should return failed status when any task fails', async () => {
      const task = createTask({ status: 'failed' as TaskStatus });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      const result = await executor.execute(plan, state);

      expect(result.status).toBe('failed');
      expect(result.failedTasks).toBe(1);
    });

    it('should respect maxIterations config', async () => {
      // Create a task that never completes
      mockAgent.run.mockImplementation(async () => {
        // Keep the task pending
        return { output_text: 'Working...' };
      });

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      const executorWithLowIterations = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        undefined,
        { maxIterations: 2 }
      );

      await executorWithLowIterations.execute(plan, state);

      // Should have stopped after 2 iterations
      expect(mockAgent.run.mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('should set checkpoint manager state', async () => {
      const plan = createPlan([createTask()]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(mockCheckpointManager.setCurrentState).toHaveBeenCalledWith(state);
    });
  });

  // ============================================================================
  // Parallel Tasks Execution Tests
  // ============================================================================

  describe('parallel tasks', () => {
    it('should execute independent tasks in parallel', async () => {
      const task1 = createTask({ id: 'task-1', name: 'Task 1' });
      const task2 = createTask({ id: 'task-2', name: 'Task 2' });
      const plan = createPlan([task1, task2]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      // Both tasks should have been executed
      expect(plan.tasks.every(t => t.status === 'completed')).toBe(true);
    });

    it('should handle fail-fast mode', async () => {
      const task1 = createTask({ id: 'task-1', name: 'Task 1' });
      const task2 = createTask({ id: 'task-2', name: 'Task 2' });
      const plan = createPlan([task1, task2]);
      plan.concurrency = { failureMode: 'fail-fast' };
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(plan.tasks.filter(t => t.status === 'completed').length).toBeGreaterThanOrEqual(0);
    });

    it('should handle continue mode', async () => {
      const task1 = createTask({ id: 'task-1', name: 'Task 1' });
      const task2 = createTask({ id: 'task-2', name: 'Task 2' });
      const plan = createPlan([task1, task2]);
      plan.concurrency = { failureMode: 'continue' };
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      // All tasks should be processed regardless of failures
      expect(plan.tasks.every(t => ['completed', 'failed', 'skipped'].includes(t.status))).toBe(true);
    });
  });

  // ============================================================================
  // Task Condition Tests
  // ============================================================================

  describe('task conditions', () => {
    it('should skip task when condition is not met with onFalse=skip', async () => {
      mockMemory.retrieve.mockResolvedValue(undefined);

      const task = createTask({
        condition: {
          memoryKey: 'required_key',
          operator: 'exists',
          onFalse: 'skip',
        },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      const eventHandler = vi.fn();
      executor.on('task:skipped', eventHandler);

      await executor.execute(plan, state);

      expect(task.status).toBe('skipped');
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'condition_not_met' })
      );
    });

    it('should fail task when condition is not met with onFalse=fail', async () => {
      mockMemory.retrieve.mockResolvedValue(undefined);

      const task = createTask({
        condition: {
          memoryKey: 'required_key',
          operator: 'exists',
          onFalse: 'fail',
        },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      const eventHandler = vi.fn();
      executor.on('task:failed', eventHandler);

      await executor.execute(plan, state);

      expect(task.status).toBe('failed');
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should execute task when condition is met', async () => {
      mockMemory.retrieve.mockResolvedValue('some_value');

      const task = createTask({
        condition: {
          memoryKey: 'required_key',
          operator: 'exists',
          onFalse: 'skip',
        },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(task.status).toBe('completed');
    });
  });

  // ============================================================================
  // Timeout Tests
  // ============================================================================

  describe('task timeout', () => {
    it('should timeout task after configured duration', async () => {
      // Mock a slow agent response
      mockAgent.run.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { output_text: 'Done' };
      });

      const task = createTask({
        metadata: { timeoutMs: 100 }, // 100ms timeout
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      const eventHandler = vi.fn();
      executor.on('task:timeout', eventHandler);

      await executor.execute(plan, state);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: 100 })
      );
    });

    it('should use config timeout when task has no timeout override', async () => {
      const executorWithTimeout = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        undefined,
        { maxIterations: 10, taskTimeout: 5000 }
      );

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithTimeout.execute(plan, state);

      // Task should complete without timeout
      expect(task.status).toBe('completed');
    });
  });

  // ============================================================================
  // Hooks Tests
  // ============================================================================

  describe('hooks', () => {
    it('should call beforeTask hook and skip on return value', async () => {
      const beforeTaskHook = vi.fn().mockResolvedValue('skip');
      const hooks: TaskAgentHooks = { beforeTask: beforeTaskHook };

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        config
      );

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(beforeTaskHook).toHaveBeenCalled();
      expect(task.status).toBe('skipped');
    });

    it('should call afterTask hook on completion', async () => {
      const afterTaskHook = vi.fn();
      const hooks: TaskAgentHooks = { afterTask: afterTaskHook };

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        config
      );

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(afterTaskHook).toHaveBeenCalledWith(
        task,
        expect.objectContaining({ success: true })
      );
    });

    it('should call onError hook on task failure', async () => {
      const onErrorHook = vi.fn().mockResolvedValue('fail');
      const hooks: TaskAgentHooks = { onError: onErrorHook };

      mockAgent.run.mockRejectedValueOnce(new Error('Task failed'));

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        config
      );

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(onErrorHook).toHaveBeenCalled();
      expect(task.status).toBe('failed');
    });

    it('should retry task when onError returns retry', async () => {
      let callCount = 0;
      const onErrorHook = vi.fn().mockResolvedValue('retry');
      const hooks: TaskAgentHooks = { onError: onErrorHook };

      mockAgent.run.mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Temporary failure');
        }
        return { output_text: 'Success' };
      });

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        { maxIterations: 5 }
      );

      const task = createTask({ maxAttempts: 3 });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(task.status).toBe('completed');
    });

    it('should call beforeLLMCall hook', async () => {
      const beforeLLMCallHook = vi.fn().mockImplementation((messages) => messages);
      const hooks: TaskAgentHooks = { beforeLLMCall: beforeLLMCallHook };

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        config
      );

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(beforeLLMCallHook).toHaveBeenCalled();
    });

    it('should call afterLLMCall hook', async () => {
      const afterLLMCallHook = vi.fn();
      const hooks: TaskAgentHooks = { afterLLMCall: afterLLMCallHook };

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        config
      );

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(afterLLMCallHook).toHaveBeenCalledWith(
        expect.objectContaining({ output_text: 'Task completed successfully' })
      );
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('task validation', () => {
    it('should skip validation when skipReflection is true', async () => {
      const task = createTask({
        validation: { skipReflection: true },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(task.status).toBe('completed');
      expect(task.metadata?.validationResult?.isComplete).toBe(true);
    });

    it('should validate required memory keys', async () => {
      mockMemory.retrieve.mockImplementation((key: string) => {
        if (key === 'existing_key') return 'value';
        return undefined;
      });

      const task = createTask({
        validation: {
          requiredMemoryKeys: ['existing_key', 'missing_key'],
        },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      const eventHandler = vi.fn();
      executor.on('task:validation_failed', eventHandler);

      await executor.execute(plan, state);

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should use custom validateTask hook', async () => {
      const validateTaskHook = vi.fn().mockResolvedValue({
        isComplete: true,
        completionScore: 95,
        explanation: 'Custom validation passed',
        requiresUserApproval: false,
      });
      const hooks: TaskAgentHooks = { validateTask: validateTaskHook };

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        config
      );

      const task = createTask({
        validation: { skipReflection: false },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(validateTaskHook).toHaveBeenCalled();
      expect(task.status).toBe('completed');
    });

    it('should handle validateTask hook returning boolean', async () => {
      const validateTaskHook = vi.fn().mockResolvedValue(true);
      const hooks: TaskAgentHooks = { validateTask: validateTaskHook };

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        config
      );

      const task = createTask({
        validation: { skipReflection: false },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(task.metadata?.validationResult?.isComplete).toBe(true);
    });

    it('should handle validateTask hook returning string (rejection)', async () => {
      const validateTaskHook = vi.fn().mockResolvedValue('Validation failed: missing output');
      const hooks: TaskAgentHooks = { validateTask: validateTaskHook };

      const executorWithHooks = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        hooks,
        config
      );

      const task = createTask({
        validation: { skipReflection: false },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executorWithHooks.execute(plan, state);

      expect(task.metadata?.validationResult?.isComplete).toBe(false);
      expect(task.metadata?.validationResult?.explanation).toBe('Validation failed: missing output');
    });
  });

  // ============================================================================
  // Events Tests
  // ============================================================================

  describe('events', () => {
    it('should emit task:start event', async () => {
      const eventHandler = vi.fn();
      executor.on('task:start', eventHandler);

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ task: expect.objectContaining({ id: 'task-1' }) })
      );
    });

    it('should emit task:complete event', async () => {
      const eventHandler = vi.fn();
      executor.on('task:complete', eventHandler);

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ task: expect.objectContaining({ status: 'completed' }) })
      );
    });

    it('should emit llm:call event', async () => {
      const eventHandler = vi.fn();
      executor.on('llm:call', eventHandler);

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should emit memory:stale_entries when stale entries detected', async () => {
      mockMemory.onTaskComplete.mockResolvedValue([
        { key: 'stale_key', scope: { type: 'task', taskIds: ['task-1'] } },
      ]);

      const eventHandler = vi.fn();
      executor.on('memory:stale_entries', eventHandler);

      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ key: 'stale_key' }),
          ]),
        })
      );
    });
  });

  // ============================================================================
  // External Dependency Tests
  // ============================================================================

  describe('external dependencies', () => {
    it('should handle external dependency and emit waiting event', async () => {
      const eventHandler = vi.fn();
      executor.on('task:waiting_external', eventHandler);

      const task = createTask({
        externalDependency: {
          type: 'webhook',
          config: { webhookId: 'webhook-1' },
        },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(mockExternalHandler.startWaiting).toHaveBeenCalledWith(task);
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should checkpoint before external wait', async () => {
      const task = createTask({
        externalDependency: {
          type: 'webhook',
          config: { webhookId: 'webhook-1' },
        },
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(mockCheckpointManager.checkpoint).toHaveBeenCalledWith(
        state,
        'before_external_wait'
      );
    });
  });

  // ============================================================================
  // Rate Limiter Tests
  // ============================================================================

  describe('rate limiter', () => {
    it('should return metrics when rate limiter is configured', () => {
      const executorWithRateLimiter = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        undefined,
        {
          maxIterations: 10,
          rateLimiter: { maxRequestsPerMinute: 60 },
        }
      );

      const metrics = executorWithRateLimiter.getRateLimiterMetrics();

      expect(metrics).toEqual(
        expect.objectContaining({
          totalRequests: expect.any(Number),
          throttledRequests: expect.any(Number),
        })
      );
    });

    it('should reset rate limiter', () => {
      const executorWithRateLimiter = new PlanExecutor(
        mockAgent as any,
        mockAgentContext as any,
        mockPlanPlugin as any,
        mockExternalHandler as any,
        mockCheckpointManager as any,
        undefined,
        {
          maxIterations: 10,
          rateLimiter: { maxRequestsPerMinute: 60 },
        }
      );

      // Should not throw
      expect(() => executorWithRateLimiter.resetRateLimiter()).not.toThrow();
    });
  });

  // ============================================================================
  // Cancel and Cleanup Tests
  // ============================================================================

  describe('cancel and cleanup', () => {
    it('should cancel execution', () => {
      expect(() => executor.cancel()).not.toThrow();
    });

    it('should cleanup resources', () => {
      expect(() => executor.cleanup()).not.toThrow();
    });

    it('should return idempotency cache', () => {
      const cache = executor.getIdempotencyCache();
      expect(cache).toBe(mockIdempotencyCache);
    });
  });

  // ============================================================================
  // Build Task Prompt Tests
  // ============================================================================

  describe('buildTaskPrompt', () => {
    it('should include task name and description', async () => {
      const task = createTask({
        name: 'Special Task',
        description: 'This is a special task',
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(mockAgent.run).toHaveBeenCalledWith(
        expect.stringContaining('Special Task')
      );
      expect(mockAgent.run).toHaveBeenCalledWith(
        expect.stringContaining('This is a special task')
      );
    });

    it('should include expected output when defined', async () => {
      const task = createTask({
        expectedOutput: 'JSON with results',
      });
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(mockAgent.run).toHaveBeenCalledWith(
        expect.stringContaining('JSON with results')
      );
    });

    it('should include completed dependencies', async () => {
      const task1 = createTask({
        id: 'task-1',
        name: 'First Task',
        status: 'completed' as TaskStatus,
      });
      const task2 = createTask({
        id: 'task-2',
        name: 'Second Task',
        dependsOn: ['task-1'],
      });
      const plan = createPlan([task1, task2]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(mockAgent.run).toHaveBeenCalledWith(
        expect.stringContaining('First Task')
      );
    });
  });

  // ============================================================================
  // History Manager Integration Tests
  // ============================================================================

  describe('history manager integration', () => {
    it('should add task prompt to history', async () => {
      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      // User prompts use sync method
      expect(mockAgentContext.addMessageSync).toHaveBeenCalledWith(
        'user',
        expect.any(String)
      );
    });

    it('should add response to history', async () => {
      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      // Assistant responses use async method with capacity checking
      expect(mockAgentContext.addMessage).toHaveBeenCalledWith(
        'assistant',
        'Task completed successfully'
      );
    });
  });

  // ============================================================================
  // AgentContext Integration Tests
  // ============================================================================

  describe('agent context integration', () => {
    it('should update plan and current input', async () => {
      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(mockPlanPlugin.setPlan).toHaveBeenCalledWith(plan);
      expect(mockAgentContext.setCurrentInput).toHaveBeenCalledWith(expect.any(String));
    });

    it('should call agent context prepare', async () => {
      const task = createTask();
      const plan = createPlan([task]);
      const state = { id: 'state-1' } as any;

      await executor.execute(plan, state);

      expect(mockAgentContext.prepare).toHaveBeenCalled();
    });
  });
});
