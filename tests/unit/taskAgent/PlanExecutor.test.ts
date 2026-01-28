/**
 * PlanExecutor Tests
 * Tests for the PlanExecutor class that executes plans with LLM integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanExecutor } from '@/capabilities/taskAgent/PlanExecutor.js';
import { Agent } from '@/core/Agent.js';
import { WorkingMemory } from '@/capabilities/taskAgent/WorkingMemory.js';
import { ContextManager } from '@/capabilities/taskAgent/ContextManager.js';
import { IdempotencyCache } from '@/capabilities/taskAgent/IdempotencyCache.js';
import { HistoryManager } from '@/capabilities/taskAgent/HistoryManager.js';
import { ExternalDependencyHandler } from '@/capabilities/taskAgent/ExternalDependencyHandler.js';
import { CheckpointManager } from '@/capabilities/taskAgent/CheckpointManager.js';
import { TaskAgentHooks } from '@/capabilities/taskAgent/TaskAgent.js';
import { createPlan, createTask, TaskValidation, TaskValidationResult } from '@/domain/entities/Task.js';
import { createAgentState } from '@/domain/entities/AgentState.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';
import { TaskTimeoutError, TaskValidationError } from '@/domain/errors/AIErrors.js';

describe('PlanExecutor', () => {
  let executor: PlanExecutor;
  let mockAgent: any;
  let memory: WorkingMemory;
  let contextManager: ContextManager;
  let idempotencyCache: IdempotencyCache;
  let historyManager: HistoryManager;
  let externalHandler: ExternalDependencyHandler;
  let checkpointManager: CheckpointManager;
  let hooks: TaskAgentHooks;
  let storage: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock Agent
    mockAgent = {
      model: 'gpt-4.1', // Use actual model from registry
      run: vi.fn().mockResolvedValue({
        output_text: 'Task completed successfully',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      }),
    };

    // Create real dependencies
    storage = createAgentStorage(); // For checkpointing and agent state
    const memoryStorage = storage.memory; // Extract IMemoryStorage
    memory = new WorkingMemory(memoryStorage);
    contextManager = new ContextManager(
      { maxContextTokens: 128000, softLimitPercent: 80 },
      { strategy: 'truncate' }
    );
    idempotencyCache = new IdempotencyCache({ enabled: true, ttl: 3600000 });
    historyManager = new HistoryManager({ maxMessages: 100, maxTokens: 10000 });
    externalHandler = new ExternalDependencyHandler([]);
    checkpointManager = new CheckpointManager(storage, {
      afterToolCalls: 1,
      afterLLMCalls: 1,
      beforeExternalWait: true,
      mode: 'sync',
    });

    // Create hooks spy
    hooks = {
      beforeTask: vi.fn(),
      afterTask: vi.fn(),
      beforeLLMCall: vi.fn().mockImplementation((messages) => messages),
      afterLLMCall: vi.fn(),
      onError: vi.fn().mockResolvedValue('retry'),
    };

    // Create executor
    executor = new PlanExecutor(
      mockAgent,
      memory,
      contextManager,
      idempotencyCache,
      historyManager,
      externalHandler,
      checkpointManager,
      hooks,
      { maxIterations: 10 }
    );
  });

  describe('constructor', () => {
    it('should create instance with all dependencies', () => {
      expect(executor).toBeDefined();
    });

    it('should work without hooks', () => {
      const executorNoHooks = new PlanExecutor(
        mockAgent,
        memory,
        contextManager,
        idempotencyCache,
        historyManager,
        externalHandler,
        checkpointManager,
        undefined,
        { maxIterations: 10 }
      );
      expect(executorNoHooks).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute a simple plan successfully', async () => {
      const plan = createPlan({
        goal: 'Test goal',
        tasks: [
          createTask({
            name: 'Task 1',
            description: 'First task',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      // Debug: log task result if failed
      if (result.status === 'failed') {
        console.log('Task failed:', plan.tasks[0]?.result);
        console.log('Mock called:', mockAgent.run.mock.calls.length);
      }

      expect(result.status).toBe('completed');
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(0);
      expect(mockAgent.run).toHaveBeenCalledOnce();
    });

    it('should execute multiple tasks in sequence', async () => {
      const plan = createPlan({
        goal: 'Multi-task goal',
        tasks: [
          createTask({
            name: 'Task 1',
            description: 'First task',
            dependsOn: [],
          }),
          createTask({
            name: 'Task 2',
            description: 'Second task',
            dependsOn: ['Task 1'], // Use task name for dependency
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.status).toBe('completed');
      expect(result.completedTasks).toBe(2);
      expect(mockAgent.run).toHaveBeenCalledTimes(2);
    });

    it('should return metrics from execution', async () => {
      const plan = createPlan({
        goal: 'Test metrics',
        tasks: [
          createTask({
            name: 'Task 1',
            description: 'Test task',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalLLMCalls).toBe(1);
      expect(result.metrics.totalTokensUsed).toBe(150);
      expect(result.metrics.totalCost).toBeGreaterThan(0);
    });
  });

  describe('hook integration', () => {
    it('should call beforeTask hook', async () => {
      const plan = createPlan({
        goal: 'Test hooks',
        tasks: [
          createTask({
            id: '1',
            name: 'Test Task',
            description: 'Testing beforeTask hook',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(hooks.beforeTask).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', name: 'Test Task' }),
        expect.objectContaining({
          taskId: '1',
          taskName: 'Test Task',
          attempt: 1,
        })
      );
    });

    it('should skip task when beforeTask hook returns "skip"', async () => {
      hooks.beforeTask = vi.fn().mockResolvedValue('skip');

      const plan = createPlan({
        goal: 'Test skip',
        tasks: [
          createTask({
            name: 'Task 1',
            description: 'Should be skipped',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.skippedTasks).toBe(1);
      expect(mockAgent.run).not.toHaveBeenCalled();
    });

    it('should call beforeLLMCall hook before agent execution', async () => {
      const plan = createPlan({
        goal: 'Test LLM hook',
        tasks: [
          createTask({
            name: 'Task 1',
            description: 'Test LLM call',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(hooks.beforeLLMCall).toHaveBeenCalled();
    });

    it('should call afterLLMCall hook after agent execution', async () => {
      const plan = createPlan({
        goal: 'Test LLM hook',
        tasks: [
          createTask({
            name: 'Task 1',
            description: 'Test LLM call',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(hooks.afterLLMCall).toHaveBeenCalledWith(
        expect.objectContaining({
          output_text: 'Task completed successfully',
          usage: expect.any(Object),
        })
      );
    });

    it('should call afterTask hook on successful completion', async () => {
      const plan = createPlan({
        goal: 'Test after hook',
        tasks: [
          createTask({
            id: '1',
            name: 'Task 1',
            description: 'Test afterTask',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(hooks.afterTask).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1' }),
        expect.objectContaining({
          success: true,
          output: 'Task completed successfully',
        })
      );
    });

    it('should call onError hook when task fails', async () => {
      mockAgent.run.mockRejectedValueOnce(new Error('Test error'));

      const plan = createPlan({
        goal: 'Test error',
        tasks: [
          createTask({
            name: 'Failing Task',
            description: 'This will fail',
            dependsOn: [],
            maxAttempts: 1,
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(hooks.onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          phase: 'execution',
          error: expect.any(Error),
        })
      );
    });

    it('should skip task when onError hook returns "skip"', async () => {
      mockAgent.run.mockRejectedValueOnce(new Error('Test error'));
      hooks.onError = vi.fn().mockResolvedValue('skip');

      const plan = createPlan({
        goal: 'Test error skip',
        tasks: [
          createTask({
            name: 'Failing Task',
            description: 'This will fail',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.skippedTasks).toBe(1);
    });

    it('should fail task when onError hook returns "fail"', async () => {
      mockAgent.run.mockRejectedValueOnce(new Error('Test error'));
      hooks.onError = vi.fn().mockResolvedValue('fail');

      const plan = createPlan({
        goal: 'Test error fail',
        tasks: [
          createTask({
            name: 'Failing Task',
            description: 'This will fail',
            dependsOn: [],
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.failedTasks).toBe(1);
    });
  });

  describe('metrics tracking', () => {
    it('should track LLM calls', async () => {
      const plan = createPlan({
        goal: 'Track LLM calls',
        tasks: [
          createTask({ name: 'Task 1', description: 'First', dependsOn: [] }),
          createTask({ name: 'Task 2', description: 'Second', dependsOn: [] }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.metrics.totalLLMCalls).toBe(2);
    });

    it('should track token usage', async () => {
      const plan = createPlan({
        goal: 'Track tokens',
        tasks: [
          createTask({ name: 'Task 1', description: 'Test', dependsOn: [] }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.metrics.totalTokensUsed).toBe(150);
    });

    it('should calculate cost from model and tokens', async () => {
      const plan = createPlan({
        goal: 'Track cost',
        tasks: [
          createTask({ name: 'Task 1', description: 'Test', dependsOn: [] }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.metrics.totalCost).toBeGreaterThan(0);
    });

    it('should accumulate metrics across multiple tasks', async () => {
      mockAgent.run
        .mockResolvedValueOnce({
          output_text: 'Task 1 done',
          usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
        })
        .mockResolvedValueOnce({
          output_text: 'Task 2 done',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });

      const plan = createPlan({
        goal: 'Accumulate metrics',
        tasks: [
          createTask({ name: 'Task 1', description: 'First', dependsOn: [] }),
          createTask({ name: 'Task 2', description: 'Second', dependsOn: [] }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.metrics.totalLLMCalls).toBe(2);
      expect(result.metrics.totalTokensUsed).toBe(450);
    });
  });

  describe('checkpointing', () => {
    it('should checkpoint after LLM call', async () => {
      const checkpointSpy = vi.spyOn(checkpointManager, 'onLLMCall');

      const plan = createPlan({
        goal: 'Test checkpointing',
        tasks: [
          createTask({ name: 'Task 1', description: 'Test', dependsOn: [] }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(checkpointSpy).toHaveBeenCalled();
    });

    it('should checkpoint before external wait', async () => {
      const checkpointSpy = vi.spyOn(checkpointManager, 'checkpoint');

      const plan = createPlan({
        goal: 'Test external wait',
        tasks: [
          createTask({
            name: 'Task 1',
            description: 'External task',
            dependsOn: [],
            externalDependency: {
              type: 'webhook',
              webhookUrl: '/webhook/test',
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(checkpointSpy).toHaveBeenCalledWith(
        state,
        'before_external_wait'
      );
    });
  });

  describe('condition evaluation', () => {
    it('should skip task when condition is not met and onFalse is "skip"', async () => {
      await memory.store('flag', 'Flag value', false);

      const plan = createPlan({
        goal: 'Test condition skip',
        tasks: [
          createTask({
            name: 'Conditional Task',
            description: 'Should be skipped',
            dependsOn: [],
            condition: {
              memoryKey: 'flag',
              operator: 'equals',
              value: true,
              onFalse: 'skip',
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.skippedTasks).toBe(1);
      expect(mockAgent.run).not.toHaveBeenCalled();
    });

    it('should fail task when condition is not met and onFalse is "fail"', async () => {
      await memory.store('flag', 'Flag value', false);

      const plan = createPlan({
        goal: 'Test condition fail',
        tasks: [
          createTask({
            name: 'Conditional Task',
            description: 'Should fail',
            dependsOn: [],
            condition: {
              memoryKey: 'flag',
              operator: 'equals',
              value: true,
              onFalse: 'fail',
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.failedTasks).toBe(1);
    });

    it('should execute task when condition is met', async () => {
      await memory.store('flag', 'Flag value', true);

      const plan = createPlan({
        goal: 'Test condition success',
        tasks: [
          createTask({
            name: 'Conditional Task',
            description: 'Should execute',
            dependsOn: [],
            condition: {
              memoryKey: 'flag',
              operator: 'equals',
              value: true,
              onFalse: 'skip',
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.completedTasks).toBe(1);
      expect(mockAgent.run).toHaveBeenCalled();
    });
  });

  describe('error handling and retry', () => {
    it('should track task attempts on failure', async () => {
      mockAgent.run.mockRejectedValue(new Error('Always fails'));

      const plan = createPlan({
        goal: 'Test retry',
        tasks: [
          createTask({
            name: 'Retry Task',
            description: 'Should track attempts',
            dependsOn: [],
            maxAttempts: 1,
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      // After failure, attempts should be incremented
      expect(plan.tasks[0]!.attempts).toBeGreaterThan(0);
    });

    it('should mark task as failed when error occurs', async () => {
      mockAgent.run.mockRejectedValue(new Error('Always fails'));

      const plan = createPlan({
        goal: 'Test max attempts',
        tasks: [
          createTask({
            name: 'Failing Task',
            description: 'Will fail',
            dependsOn: [],
            maxAttempts: 1,
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.failedTasks).toBe(1);
      expect(plan.tasks[0]!.status).toBe('failed');
      expect(plan.tasks[0]!.result?.success).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit task:start event', async () => {
      const startSpy = vi.fn();
      executor.on('task:start', startSpy);

      const plan = createPlan({
        goal: 'Test events',
        tasks: [
          createTask({ name: 'Task 1', description: 'Test', dependsOn: [] }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({ name: 'Task 1' }),
        })
      );
    });

    it('should emit task:complete event', async () => {
      // Reset mock to ensure clean state
      mockAgent.run.mockResolvedValue({
        output_text: 'Task completed successfully',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      });

      const completeSpy = vi.fn();
      executor.on('task:complete', completeSpy);

      const plan = createPlan({
        goal: 'Test events',
        tasks: [
          createTask({ name: 'Task 1', description: 'Test', dependsOn: [] }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(completeSpy).toHaveBeenCalled();
    });

    it('should emit task:failed event on failure', async () => {
      mockAgent.run.mockRejectedValue(new Error('Task failed'));
      const failedSpy = vi.fn();
      executor.on('task:failed', failedSpy);

      const plan = createPlan({
        goal: 'Test failure event',
        tasks: [
          createTask({
            name: 'Failing Task',
            description: 'Will fail',
            dependsOn: [],
            maxAttempts: 1,
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(failedSpy).toHaveBeenCalled();
    });

    it('should emit task:skipped event when skipped', async () => {
      hooks.beforeTask = vi.fn().mockResolvedValue('skip');
      const skippedSpy = vi.fn();
      executor.on('task:skipped', skippedSpy);

      const plan = createPlan({
        goal: 'Test skip event',
        tasks: [
          createTask({ name: 'Task 1', description: 'Skipped', dependsOn: [] }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(skippedSpy).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cancel execution', () => {
      expect(() => executor.cancel()).not.toThrow();
    });

    it('should cleanup resources', () => {
      expect(() => executor.cleanup()).not.toThrow();
    });
  });

  // ============ Phase 1: Task Timeout Tests ============
  describe('task timeout', () => {
    it('should complete task before timeout', async () => {
      // Fast task - should complete
      mockAgent.run.mockResolvedValue({
        output_text: 'Quick response',
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
      });

      const plan = createPlan({
        goal: 'Test fast task',
        tasks: [
          createTask({
            name: 'fast_task',
            description: 'Fast task',
            metadata: { timeoutMs: 5000 }, // 5 second timeout
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.status).toBe('completed');
      expect(result.completedTasks).toBe(1);
    });

    it('should emit task:timeout event when task times out', async () => {
      // Slow task that will timeout
      mockAgent.run.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({
          output_text: 'Eventually finished',
          usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
        }), 500); // Takes 500ms
      }));

      const timeoutSpy = vi.fn();
      executor.on('task:timeout', timeoutSpy);

      // Create executor with very short timeout
      const shortTimeoutExecutor = new PlanExecutor(
        mockAgent,
        memory,
        contextManager,
        idempotencyCache,
        historyManager,
        externalHandler,
        checkpointManager,
        hooks,
        { maxIterations: 10, taskTimeout: 100 } // 100ms timeout
      );
      shortTimeoutExecutor.on('task:timeout', timeoutSpy);

      const plan = createPlan({
        goal: 'Test timeout',
        tasks: [
          createTask({
            name: 'slow_task',
            description: 'Slow task',
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await shortTimeoutExecutor.execute(plan, state);

      expect(timeoutSpy).toHaveBeenCalled();
      expect(timeoutSpy.mock.calls[0][0]).toMatchObject({
        task: expect.objectContaining({ name: 'slow_task' }),
        timeoutMs: 100,
      });
    });

    it('should use per-task timeout override', async () => {
      // Very slow agent
      mockAgent.run.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({
          output_text: 'Done',
          usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
        }), 300);
      }));

      const timeoutSpy = vi.fn();

      const shortTimeoutExecutor = new PlanExecutor(
        mockAgent,
        memory,
        contextManager,
        idempotencyCache,
        historyManager,
        externalHandler,
        checkpointManager,
        hooks,
        { maxIterations: 10, taskTimeout: 1000 } // 1s default
      );
      shortTimeoutExecutor.on('task:timeout', timeoutSpy);

      const plan = createPlan({
        goal: 'Test per-task timeout',
        tasks: [
          createTask({
            name: 'urgent_task',
            description: 'Urgent task with short timeout',
            metadata: { timeoutMs: 50 }, // Override: 50ms
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await shortTimeoutExecutor.execute(plan, state);

      // Should timeout because per-task override (50ms) < execution time (300ms)
      expect(timeoutSpy).toHaveBeenCalled();
      expect(timeoutSpy.mock.calls[0][0].timeoutMs).toBe(50);
    });

    it('should retry task after timeout if attempts remain', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call times out
          return new Promise((resolve) => {
            setTimeout(() => resolve({
              output_text: 'Too slow',
              usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
            }), 200);
          });
        }
        // Subsequent calls are fast
        return Promise.resolve({
          output_text: 'Quick this time',
          usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
        });
      });

      const shortTimeoutExecutor = new PlanExecutor(
        mockAgent,
        memory,
        contextManager,
        idempotencyCache,
        historyManager,
        externalHandler,
        checkpointManager,
        { onError: vi.fn().mockResolvedValue('retry') },
        { maxIterations: 10, taskTimeout: 50 }
      );

      const plan = createPlan({
        goal: 'Test retry after timeout',
        tasks: [
          createTask({
            name: 'retry_task',
            description: 'Task that retries',
            maxAttempts: 3,
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await shortTimeoutExecutor.execute(plan, state);

      // Task should eventually complete after retry
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should fail task after max attempts with timeout', async () => {
      // Always slow - will always timeout
      mockAgent.run.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({
          output_text: 'Always slow',
          usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
        }), 200);
      }));

      const failedSpy = vi.fn();
      const shortTimeoutExecutor = new PlanExecutor(
        mockAgent,
        memory,
        contextManager,
        idempotencyCache,
        historyManager,
        externalHandler,
        checkpointManager,
        { onError: vi.fn().mockResolvedValue('retry') },
        { maxIterations: 10, taskTimeout: 50 }
      );
      shortTimeoutExecutor.on('task:failed', failedSpy);

      const plan = createPlan({
        goal: 'Test fail after max attempts',
        tasks: [
          createTask({
            name: 'always_slow',
            description: 'Always times out',
            maxAttempts: 2,
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await shortTimeoutExecutor.execute(plan, state);

      expect(result.failedTasks).toBe(1);
      expect(failedSpy).toHaveBeenCalled();
    });
  });

  // ============ Phase 1: Task Validation Tests ============
  describe('task validation', () => {
    it('should skip validation when no validation config', async () => {
      const plan = createPlan({
        goal: 'Test no validation',
        tasks: [
          createTask({
            name: 'simple_task',
            description: 'No validation config',
            // No validation field
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.status).toBe('completed');
      expect(result.completedTasks).toBe(1);
      // Should only call LLM once (for task execution, not validation)
      expect(mockAgent.run).toHaveBeenCalledTimes(1);
    });

    it('should skip validation when skipReflection is true', async () => {
      const plan = createPlan({
        goal: 'Test skip reflection',
        tasks: [
          createTask({
            name: 'skip_val_task',
            description: 'Skip validation',
            validation: {
              completionCriteria: ['Some criteria'],
              skipReflection: true,
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.status).toBe('completed');
      // Only one LLM call (no validation call)
      expect(mockAgent.run).toHaveBeenCalledTimes(1);
    });

    it('should call LLM for validation when criteria are set', async () => {
      // First call: task execution, Second call: validation
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Weather data: 72F in San Francisco',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        // Validation response
        return Promise.resolve({
          output_text: '```json\n{"completionScore": 95, "isComplete": true, "explanation": "All criteria met"}\n```',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const plan = createPlan({
        goal: 'Test validation call',
        tasks: [
          createTask({
            name: 'weather_task',
            description: 'Get weather',
            validation: {
              completionCriteria: [
                'Response contains temperature',
                'Response mentions the location',
              ],
              minCompletionScore: 80,
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.status).toBe('completed');
      expect(mockAgent.run).toHaveBeenCalledTimes(2); // Task + Validation
    });

    it('should emit validation_failed event when score below threshold', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Some output',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        // Low validation score
        return Promise.resolve({
          output_text: '```json\n{"completionScore": 45, "isComplete": false, "explanation": "Missing key data"}\n```',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const validationFailedSpy = vi.fn();
      executor.on('task:validation_failed', validationFailedSpy);

      const plan = createPlan({
        goal: 'Test validation failure',
        tasks: [
          createTask({
            name: 'incomplete_task',
            description: 'Task with low score',
            validation: {
              completionCriteria: ['Criteria 1', 'Criteria 2'],
              minCompletionScore: 80,
              mode: 'warn', // Warn mode - completes anyway
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(validationFailedSpy).toHaveBeenCalled();
      const eventData = validationFailedSpy.mock.calls[0][0];
      expect(eventData.validation.completionScore).toBe(45);
      expect(eventData.validation.isComplete).toBe(false);
    });

    it('should fail task in strict mode when validation fails', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Incomplete output',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        return Promise.resolve({
          output_text: '```json\n{"completionScore": 30, "isComplete": false, "explanation": "Failed"}\n```',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const plan = createPlan({
        goal: 'Test strict mode',
        tasks: [
          createTask({
            name: 'strict_task',
            description: 'Task with strict validation',
            validation: {
              completionCriteria: ['Must have X', 'Must have Y'],
              minCompletionScore: 80,
              mode: 'strict', // Strict mode - fails the task
            },
            maxAttempts: 1, // Don't retry
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executor.execute(plan, state);

      expect(result.failedTasks).toBe(1);
    });

    it('should emit validation_uncertain when score in uncertain range', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Partial output',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        // Score in uncertain range (60-80 for default minScore of 80)
        return Promise.resolve({
          output_text: '```json\n{"completionScore": 70, "isComplete": false, "explanation": "Partially complete"}\n```',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const uncertainSpy = vi.fn();
      executor.on('task:validation_uncertain', uncertainSpy);

      const plan = createPlan({
        goal: 'Test uncertain',
        tasks: [
          createTask({
            name: 'uncertain_task',
            description: 'Task with uncertain result',
            validation: {
              completionCriteria: ['Criteria'],
              minCompletionScore: 80,
              requireUserApproval: 'uncertain',
              mode: 'warn',
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(uncertainSpy).toHaveBeenCalled();
      const eventData = uncertainSpy.mock.calls[0][0];
      expect(eventData.validation.requiresUserApproval).toBe(true);
    });

    it('should check required memory keys', async () => {
      // Don't store anything in memory
      const plan = createPlan({
        goal: 'Test memory keys',
        tasks: [
          createTask({
            name: 'memory_task',
            description: 'Task requiring memory keys',
            validation: {
              requiredMemoryKeys: ['required_data', 'other_data'],
              mode: 'warn',
            },
          }),
        ],
      });

      const validationFailedSpy = vi.fn();
      executor.on('task:validation_failed', validationFailedSpy);

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(validationFailedSpy).toHaveBeenCalled();
      const eventData = validationFailedSpy.mock.calls[0][0];
      expect(eventData.validation.explanation).toContain('memory keys not found');
    });

    it('should use custom validateTask hook', async () => {
      const customHooks: TaskAgentHooks = {
        ...hooks,
        validateTask: vi.fn().mockResolvedValue({
          isComplete: true,
          completionScore: 100,
          explanation: 'Custom validation passed',
          requiresUserApproval: false,
        } as TaskValidationResult),
      };

      const executorWithHook = new PlanExecutor(
        mockAgent,
        memory,
        contextManager,
        idempotencyCache,
        historyManager,
        externalHandler,
        checkpointManager,
        customHooks,
        { maxIterations: 10 }
      );

      const plan = createPlan({
        goal: 'Test custom hook',
        tasks: [
          createTask({
            name: 'hook_task',
            description: 'Task with custom validation hook',
            validation: {
              completionCriteria: ['Some criteria'], // Has criteria but hook should be used
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executorWithHook.execute(plan, state);

      expect(customHooks.validateTask).toHaveBeenCalled();
      expect(result.status).toBe('completed');
    });

    it('should handle validateTask hook returning boolean', async () => {
      const customHooks: TaskAgentHooks = {
        validateTask: vi.fn().mockResolvedValue(true),
      };

      const executorWithHook = new PlanExecutor(
        mockAgent,
        memory,
        contextManager,
        idempotencyCache,
        historyManager,
        externalHandler,
        checkpointManager,
        customHooks,
        { maxIterations: 10 }
      );

      const plan = createPlan({
        goal: 'Test boolean hook',
        tasks: [
          createTask({
            name: 'bool_task',
            description: 'Task',
            validation: { completionCriteria: ['X'] },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      const result = await executorWithHook.execute(plan, state);

      expect(result.status).toBe('completed');
    });

    it('should handle validateTask hook returning string (rejection)', async () => {
      const customHooks: TaskAgentHooks = {
        validateTask: vi.fn().mockResolvedValue('Rejected: missing required data'),
      };

      const executorWithHook = new PlanExecutor(
        mockAgent,
        memory,
        contextManager,
        idempotencyCache,
        historyManager,
        externalHandler,
        checkpointManager,
        customHooks,
        { maxIterations: 10 }
      );

      const validationFailedSpy = vi.fn();
      executorWithHook.on('task:validation_failed', validationFailedSpy);

      const plan = createPlan({
        goal: 'Test string rejection',
        tasks: [
          createTask({
            name: 'reject_task',
            description: 'Task',
            validation: { completionCriteria: ['X'], mode: 'warn' },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executorWithHook.execute(plan, state);

      expect(validationFailedSpy).toHaveBeenCalled();
      const eventData = validationFailedSpy.mock.calls[0][0];
      expect(eventData.validation.explanation).toBe('Rejected: missing required data');
    });

    it('should store validation result in task metadata', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Task output',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        return Promise.resolve({
          output_text: '```json\n{"completionScore": 90, "isComplete": true, "explanation": "Good"}\n```',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const plan = createPlan({
        goal: 'Test metadata',
        tasks: [
          createTask({
            name: 'meta_task',
            description: 'Task',
            validation: { completionCriteria: ['X'] },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(plan.tasks[0].metadata?.validationResult).toBeDefined();
      expect((plan.tasks[0].metadata?.validationResult as any).completionScore).toBe(90);
    });

    it('should include validation score in task result', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Output',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        return Promise.resolve({
          output_text: '```json\n{"completionScore": 88, "isComplete": true, "explanation": "Well done"}\n```',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const plan = createPlan({
        goal: 'Test result fields',
        tasks: [
          createTask({
            name: 'result_task',
            description: 'Task',
            validation: { completionCriteria: ['X'] },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(plan.tasks[0].result?.validationScore).toBe(88);
      expect(plan.tasks[0].result?.validationExplanation).toBe('Well done');
    });

    it('should parse inline JSON without code blocks', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Output',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        // JSON without code blocks
        return Promise.resolve({
          output_text: 'Here is my evaluation: {"completionScore": 85, "isComplete": true, "explanation": "Looks good"}',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const plan = createPlan({
        goal: 'Test inline JSON',
        tasks: [
          createTask({
            name: 'inline_task',
            description: 'Task',
            validation: { completionCriteria: ['X'] },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(plan.tasks[0].result?.validationScore).toBe(85);
    });

    it('should extract score from text when JSON parsing fails', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Output',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        // No valid JSON, just text with score
        return Promise.resolve({
          output_text: 'The task is about 75% complete based on my analysis.',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const plan = createPlan({
        goal: 'Test text extraction',
        tasks: [
          createTask({
            name: 'text_task',
            description: 'Task',
            validation: { completionCriteria: ['X'], mode: 'warn' },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(plan.tasks[0].result?.validationScore).toBe(75);
    });

    it('should handle requireUserApproval always', async () => {
      let callCount = 0;
      mockAgent.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            output_text: 'Output',
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          });
        }
        return Promise.resolve({
          output_text: '```json\n{"completionScore": 95, "isComplete": true, "explanation": "Perfect"}\n```',
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        });
      });

      const uncertainSpy = vi.fn();
      executor.on('task:validation_uncertain', uncertainSpy);

      const plan = createPlan({
        goal: 'Test always approval',
        tasks: [
          createTask({
            name: 'always_approval_task',
            description: 'Task',
            validation: {
              completionCriteria: ['X'],
              requireUserApproval: 'always',
            },
          }),
        ],
      });

      const state = createAgentState('test-agent', {} as any, plan);
      await executor.execute(plan, state);

      expect(uncertainSpy).toHaveBeenCalled();
      const eventData = uncertainSpy.mock.calls[0][0];
      expect(eventData.validation.requiresUserApproval).toBe(true);
      expect(eventData.validation.approvalReason).toContain('User approval required');
    });
  });
});
