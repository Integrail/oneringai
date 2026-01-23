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
import { createPlan, createTask } from '@/domain/entities/Task.js';
import { createAgentState } from '@/domain/entities/AgentState.js';
import { createAgentStorage } from '@/infrastructure/storage/InMemoryStorage.js';

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
});
