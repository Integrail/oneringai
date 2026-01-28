/**
 * Task Entity Tests
 * Tests for Task, Plan, and related utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  Task,
  TaskInput,
  TaskStatus,
  TaskCondition,
  ExternalDependency,
  Plan,
  PlanInput,
  PlanStatus,
  PlanConcurrency,
  TaskValidation,
  TaskValidationResult,
  createTask,
  createPlan,
  canTaskExecute,
  getNextExecutableTasks,
  evaluateCondition,
  updateTaskStatus,
  isTaskBlocked,
  getTaskDependencies,
  resolveDependencies,
  detectDependencyCycle,
} from '@/domain/entities/Task.js';
import { DependencyCycleError } from '@/domain/errors/AIErrors.js';

describe('Task Entities', () => {
  describe('createTask', () => {
    it('should create task with defaults', () => {
      const task = createTask({
        name: 'fetch_data',
        description: 'Fetch user data from API',
      });

      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^task-/);
      expect(task.name).toBe('fetch_data');
      expect(task.description).toBe('Fetch user data from API');
      expect(task.status).toBe('pending');
      expect(task.dependsOn).toEqual([]);
      expect(task.attempts).toBe(0);
      expect(task.maxAttempts).toBe(3);
      expect(task.createdAt).toBeDefined();
      expect(task.lastUpdatedAt).toBeDefined();
    });

    it('should create task with custom id', () => {
      const task = createTask({
        id: 'custom-id-123',
        name: 'test',
        description: 'Test task',
      });

      expect(task.id).toBe('custom-id-123');
    });

    it('should create task with dependencies', () => {
      const task = createTask({
        name: 'process_data',
        description: 'Process the fetched data',
        dependsOn: ['task-1', 'task-2'],
      });

      expect(task.dependsOn).toEqual(['task-1', 'task-2']);
    });

    it('should create task with external dependency - webhook', () => {
      const task = createTask({
        name: 'wait_approval',
        description: 'Wait for manager approval',
        externalDependency: {
          type: 'webhook',
          webhookId: 'approval-123',
          timeoutMs: 86400000,
          state: 'waiting',
        },
      });

      expect(task.externalDependency).toBeDefined();
      expect(task.externalDependency!.type).toBe('webhook');
      expect(task.externalDependency!.webhookId).toBe('approval-123');
      expect(task.externalDependency!.timeoutMs).toBe(86400000);
      expect(task.externalDependency!.state).toBe('waiting');
    });

    it('should create task with external dependency - poll', () => {
      const task = createTask({
        name: 'wait_job',
        description: 'Wait for batch job to complete',
        externalDependency: {
          type: 'poll',
          pollConfig: {
            toolName: 'check_job_status',
            toolArgs: { jobId: 'job-123' },
            intervalMs: 30000,
            maxAttempts: 60,
          },
          state: 'waiting',
        },
      });

      expect(task.externalDependency!.type).toBe('poll');
      expect(task.externalDependency!.pollConfig).toBeDefined();
      expect(task.externalDependency!.pollConfig!.toolName).toBe('check_job_status');
    });

    it('should create task with external dependency - manual', () => {
      const task = createTask({
        name: 'manual_review',
        description: 'Requires manual approval',
        externalDependency: {
          type: 'manual',
          manualDescription: 'Please review and approve the document',
          state: 'waiting',
        },
      });

      expect(task.externalDependency!.type).toBe('manual');
      expect(task.externalDependency!.manualDescription).toBe('Please review and approve the document');
    });

    it('should create task with external dependency - scheduled', () => {
      const futureTime = Date.now() + 3600000; // 1 hour from now
      const task = createTask({
        name: 'scheduled_task',
        description: 'Run at scheduled time',
        externalDependency: {
          type: 'scheduled',
          scheduledAt: futureTime,
          state: 'waiting',
        },
      });

      expect(task.externalDependency!.type).toBe('scheduled');
      expect(task.externalDependency!.scheduledAt).toBe(futureTime);
    });

    it('should create task with condition', () => {
      const task = createTask({
        name: 'send_premium_email',
        description: 'Send email to premium users',
        condition: {
          memoryKey: 'user.isPremium',
          operator: 'equals',
          value: true,
          onFalse: 'skip',
        },
      });

      expect(task.condition).toBeDefined();
      expect(task.condition!.memoryKey).toBe('user.isPremium');
      expect(task.condition!.operator).toBe('equals');
      expect(task.condition!.value).toBe(true);
      expect(task.condition!.onFalse).toBe('skip');
    });

    it('should create task with parallel execution settings', () => {
      const task = createTask({
        name: 'fetch_parallel',
        description: 'Can run in parallel',
        execution: {
          parallel: true,
          priority: 10,
        },
      });

      expect(task.execution?.parallel).toBe(true);
      expect(task.execution?.priority).toBe(10);
    });

    it('should create task with custom maxAttempts', () => {
      const task = createTask({
        name: 'retry_task',
        description: 'Task with custom retry',
        maxAttempts: 5,
      });

      expect(task.maxAttempts).toBe(5);
    });

    it('should create task with expectedOutput', () => {
      const task = createTask({
        name: 'api_call',
        description: 'Call API',
        expectedOutput: 'JSON response with user data including id and email',
      });

      expect(task.expectedOutput).toBe('JSON response with user data including id and email');
    });

    it('should create task with metadata', () => {
      const task = createTask({
        name: 'tagged_task',
        description: 'Task with metadata',
        metadata: {
          category: 'api',
          priority: 'high',
          tags: ['critical', 'user-facing'],
        },
      });

      expect(task.metadata).toEqual({
        category: 'api',
        priority: 'high',
        tags: ['critical', 'user-facing'],
      });
    });
  });

  describe('createPlan', () => {
    it('should create plan with goal and tasks', () => {
      const plan = createPlan({
        goal: 'Process customer refund',
        tasks: [
          { name: 'fetch_order', description: 'Get order details' },
          { name: 'process_refund', description: 'Issue refund' },
        ],
      });

      expect(plan.id).toBeDefined();
      expect(plan.id).toMatch(/^plan-/);
      expect(plan.goal).toBe('Process customer refund');
      expect(plan.tasks).toHaveLength(2);
      expect(plan.status).toBe('pending');
      expect(plan.allowDynamicTasks).toBe(true);
      expect(plan.createdAt).toBeDefined();
    });

    it('should create plan with context', () => {
      const plan = createPlan({
        goal: 'Onboard user',
        context: 'New enterprise customer, requires special handling',
        tasks: [],
      });

      expect(plan.context).toBe('New enterprise customer, requires special handling');
    });

    it('should resolve task name dependencies to IDs', () => {
      const plan = createPlan({
        goal: 'Test',
        tasks: [
          { name: 'first', description: 'First task' },
          { name: 'second', description: 'Second task', dependsOn: ['first'] },
          { name: 'third', description: 'Third task', dependsOn: ['first', 'second'] },
        ],
      });

      const firstTask = plan.tasks.find((t) => t.name === 'first')!;
      const secondTask = plan.tasks.find((t) => t.name === 'second')!;
      const thirdTask = plan.tasks.find((t) => t.name === 'third')!;

      expect(secondTask.dependsOn).toContain(firstTask.id);
      expect(thirdTask.dependsOn).toContain(firstTask.id);
      expect(thirdTask.dependsOn).toContain(secondTask.id);
    });

    it('should throw on invalid dependency reference', () => {
      expect(() =>
        createPlan({
          goal: 'Test',
          tasks: [
            { name: 'first', description: 'First task' },
            { name: 'second', description: 'Second task', dependsOn: ['nonexistent'] },
          ],
        })
      ).toThrow(/dependency.*not found/i);
    });

    it('should set concurrency settings', () => {
      const plan = createPlan({
        goal: 'Parallel work',
        tasks: [],
        concurrency: {
          maxParallelTasks: 3,
          strategy: 'priority',
        },
      });

      expect(plan.concurrency?.maxParallelTasks).toBe(3);
      expect(plan.concurrency?.strategy).toBe('priority');
    });

    it('should disable dynamic tasks when specified', () => {
      const plan = createPlan({
        goal: 'Fixed plan',
        tasks: [],
        allowDynamicTasks: false,
      });

      expect(plan.allowDynamicTasks).toBe(false);
    });

    it('should create plan with metadata', () => {
      const plan = createPlan({
        goal: 'Test',
        tasks: [],
        metadata: {
          customer: 'acme-corp',
          priority: 1,
        },
      });

      expect(plan.metadata).toEqual({
        customer: 'acme-corp',
        priority: 1,
      });
    });
  });

  describe('canTaskExecute', () => {
    it('should return true for pending task with no dependencies', () => {
      const task = createTask({ name: 'standalone', description: 'No deps' });
      const allTasks: Task[] = [task];

      expect(canTaskExecute(task, allTasks)).toBe(true);
    });

    it('should return false for non-pending task', () => {
      const task: Task = {
        ...createTask({ name: 'running', description: 'Running' }),
        status: 'in_progress',
      };

      expect(canTaskExecute(task, [task])).toBe(false);
    });

    it('should return false for completed task', () => {
      const task: Task = {
        ...createTask({ name: 'done', description: 'Done' }),
        status: 'completed',
      };

      expect(canTaskExecute(task, [task])).toBe(false);
    });

    it('should return false for task with pending dependencies', () => {
      const task1 = createTask({ name: 'first', description: 'First' });
      const task2 = createTask({
        name: 'second',
        description: 'Second',
        dependsOn: [task1.id],
      });

      expect(canTaskExecute(task2, [task1, task2])).toBe(false);
    });

    it('should return true for task with completed dependencies', () => {
      const task1: Task = {
        ...createTask({ name: 'first', description: 'First' }),
        status: 'completed',
      };
      const task2 = createTask({
        name: 'second',
        description: 'Second',
        dependsOn: [task1.id],
      });

      expect(canTaskExecute(task2, [task1, task2])).toBe(true);
    });

    it('should return false for task with failed dependency', () => {
      const task1: Task = {
        ...createTask({ name: 'first', description: 'First' }),
        status: 'failed',
      };
      const task2 = createTask({
        name: 'second',
        description: 'Second',
        dependsOn: [task1.id],
      });

      expect(canTaskExecute(task2, [task1, task2])).toBe(false);
    });

    it('should return false for task with in_progress dependency', () => {
      const task1: Task = {
        ...createTask({ name: 'first', description: 'First' }),
        status: 'in_progress',
      };
      const task2 = createTask({
        name: 'second',
        description: 'Second',
        dependsOn: [task1.id],
      });

      expect(canTaskExecute(task2, [task1, task2])).toBe(false);
    });

    it('should return true with multiple completed dependencies', () => {
      const task1: Task = {
        ...createTask({ name: 'first', description: 'First' }),
        status: 'completed',
      };
      const task2: Task = {
        ...createTask({ name: 'second', description: 'Second' }),
        status: 'completed',
      };
      const task3 = createTask({
        name: 'third',
        description: 'Third',
        dependsOn: [task1.id, task2.id],
      });

      expect(canTaskExecute(task3, [task1, task2, task3])).toBe(true);
    });

    it('should return false with one incomplete dependency', () => {
      const task1: Task = {
        ...createTask({ name: 'first', description: 'First' }),
        status: 'completed',
      };
      const task2 = createTask({ name: 'second', description: 'Second' });
      const task3 = createTask({
        name: 'third',
        description: 'Third',
        dependsOn: [task1.id, task2.id],
      });

      expect(canTaskExecute(task3, [task1, task2, task3])).toBe(false);
    });
  });

  describe('getNextExecutableTasks', () => {
    it('should return all independent pending tasks for parallel execution', () => {
      const tasks = [
        createTask({ name: 'a', description: 'A', execution: { parallel: true } }),
        createTask({ name: 'b', description: 'B', execution: { parallel: true } }),
        createTask({ name: 'c', description: 'C', execution: { parallel: true } }),
      ];

      const plan: Plan = {
        ...createPlan({ goal: 'Test', tasks: [] }),
        tasks,
        concurrency: { maxParallelTasks: 3, strategy: 'fifo' },
      };

      const executable = getNextExecutableTasks(plan);
      expect(executable).toHaveLength(3);
    });

    it('should respect maxParallelTasks', () => {
      const tasks = [
        createTask({ name: 'a', description: 'A', execution: { parallel: true } }),
        createTask({ name: 'b', description: 'B', execution: { parallel: true } }),
        createTask({ name: 'c', description: 'C', execution: { parallel: true } }),
      ];

      const plan: Plan = {
        ...createPlan({ goal: 'Test', tasks: [] }),
        tasks,
        concurrency: { maxParallelTasks: 2, strategy: 'fifo' },
      };

      const executable = getNextExecutableTasks(plan);
      expect(executable).toHaveLength(2);
    });

    it('should respect priority when strategy is priority', () => {
      const tasks = [
        createTask({ name: 'low', description: 'Low', execution: { parallel: true, priority: 1 } }),
        createTask({ name: 'high', description: 'High', execution: { parallel: true, priority: 10 } }),
        createTask({ name: 'medium', description: 'Medium', execution: { parallel: true, priority: 5 } }),
      ];

      const plan: Plan = {
        ...createPlan({ goal: 'Test', tasks: [] }),
        tasks,
        concurrency: { maxParallelTasks: 2, strategy: 'priority' },
      };

      const executable = getNextExecutableTasks(plan);
      expect(executable[0].name).toBe('high');
      expect(executable[1].name).toBe('medium');
    });

    it('should return single task when no parallel execution configured', () => {
      const tasks = [
        createTask({ name: 'a', description: 'A' }),
        createTask({ name: 'b', description: 'B' }),
      ];

      const plan: Plan = {
        ...createPlan({ goal: 'Test', tasks: [] }),
        tasks,
        // No concurrency config = sequential
      };

      const executable = getNextExecutableTasks(plan);
      expect(executable).toHaveLength(1);
    });

    it('should not return tasks with unmet dependencies', () => {
      const task1 = createTask({ name: 'first', description: 'First' });
      const task2 = createTask({
        name: 'second',
        description: 'Second',
        dependsOn: [task1.id],
      });

      const plan: Plan = {
        ...createPlan({ goal: 'Test', tasks: [] }),
        tasks: [task1, task2],
        concurrency: { maxParallelTasks: 2, strategy: 'fifo' },
      };

      const executable = getNextExecutableTasks(plan);
      expect(executable).toHaveLength(1);
      expect(executable[0].name).toBe('first');
    });

    it('should skip already running tasks', () => {
      const task1: Task = {
        ...createTask({ name: 'running', description: 'Running' }),
        status: 'in_progress',
      };
      const task2 = createTask({ name: 'pending', description: 'Pending' });

      const plan: Plan = {
        ...createPlan({ goal: 'Test', tasks: [] }),
        tasks: [task1, task2],
      };

      const executable = getNextExecutableTasks(plan);
      expect(executable).toHaveLength(1);
      expect(executable[0].name).toBe('pending');
    });

    it('should return empty array when all tasks are done', () => {
      const tasks: Task[] = [
        { ...createTask({ name: 'a', description: 'A' }), status: 'completed' },
        { ...createTask({ name: 'b', description: 'B' }), status: 'completed' },
      ];

      const plan: Plan = {
        ...createPlan({ goal: 'Test', tasks: [] }),
        tasks,
      };

      const executable = getNextExecutableTasks(plan);
      expect(executable).toHaveLength(0);
    });

    it('should consider currently running tasks against maxParallelTasks', () => {
      const task1: Task = {
        ...createTask({ name: 'running1', description: 'Running 1', execution: { parallel: true } }),
        status: 'in_progress',
      };
      const task2: Task = {
        ...createTask({ name: 'running2', description: 'Running 2', execution: { parallel: true } }),
        status: 'in_progress',
      };
      const task3 = createTask({ name: 'pending', description: 'Pending', execution: { parallel: true } });

      const plan: Plan = {
        ...createPlan({ goal: 'Test', tasks: [] }),
        tasks: [task1, task2, task3],
        concurrency: { maxParallelTasks: 2, strategy: 'fifo' },
      };

      const executable = getNextExecutableTasks(plan);
      expect(executable).toHaveLength(0); // Max parallel already reached
    });
  });

  describe('evaluateCondition', () => {
    const createMockMemory = (store: Record<string, unknown>) => ({
      get: async (key: string) => store[key],
    });

    const memory = createMockMemory({
      'user.isPremium': true,
      'user.name': 'John',
      'order.total': 150,
      'flags.enabled': ['feature1', 'feature2'],
      'empty.value': null,
      'zero.value': 0,
      'false.value': false,
    });

    it('should evaluate "exists" condition - true', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'user.isPremium', operator: 'exists', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(true);
    });

    it('should evaluate "exists" condition - false', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'nonexistent', operator: 'exists', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(false);
    });

    it('should evaluate "not_exists" condition - true', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'nonexistent', operator: 'not_exists', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(true);
    });

    it('should evaluate "not_exists" condition - false', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'user.name', operator: 'not_exists', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(false);
    });

    it('should evaluate "equals" condition - true', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'user.isPremium', operator: 'equals', value: true, onFalse: 'skip' },
        memory
      );
      expect(result).toBe(true);
    });

    it('should evaluate "equals" condition - false', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'user.name', operator: 'equals', value: 'Jane', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(false);
    });

    it('should evaluate "equals" condition with number', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'order.total', operator: 'equals', value: 150, onFalse: 'skip' },
        memory
      );
      expect(result).toBe(true);
    });

    it('should evaluate "contains" condition for arrays - true', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'flags.enabled', operator: 'contains', value: 'feature1', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(true);
    });

    it('should evaluate "contains" condition for arrays - false', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'flags.enabled', operator: 'contains', value: 'feature3', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(false);
    });

    it('should evaluate "contains" condition for strings', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'user.name', operator: 'contains', value: 'oh', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(true);
    });

    it('should evaluate "truthy" condition - true', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'user.isPremium', operator: 'truthy', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(true);
    });

    it('should evaluate "truthy" condition - false for nonexistent', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'nonexistent', operator: 'truthy', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(false);
    });

    it('should evaluate "truthy" condition - false for null', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'empty.value', operator: 'truthy', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(false);
    });

    it('should evaluate "truthy" condition - false for zero', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'zero.value', operator: 'truthy', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(false);
    });

    it('should evaluate "truthy" condition - false for false', async () => {
      const result = await evaluateCondition(
        { memoryKey: 'false.value', operator: 'truthy', onFalse: 'skip' },
        memory
      );
      expect(result).toBe(false);
    });

    it('should handle "greater_than" operator', async () => {
      const resultTrue = await evaluateCondition(
        { memoryKey: 'order.total', operator: 'greater_than', value: 100, onFalse: 'skip' },
        memory
      );
      expect(resultTrue).toBe(true);

      const resultFalse = await evaluateCondition(
        { memoryKey: 'order.total', operator: 'greater_than', value: 200, onFalse: 'skip' },
        memory
      );
      expect(resultFalse).toBe(false);
    });

    it('should handle "less_than" operator', async () => {
      const resultTrue = await evaluateCondition(
        { memoryKey: 'order.total', operator: 'less_than', value: 200, onFalse: 'skip' },
        memory
      );
      expect(resultTrue).toBe(true);

      const resultFalse = await evaluateCondition(
        { memoryKey: 'order.total', operator: 'less_than', value: 100, onFalse: 'skip' },
        memory
      );
      expect(resultFalse).toBe(false);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update status and lastUpdatedAt', () => {
      const task = createTask({ name: 'test', description: 'Test' });
      const originalUpdatedAt = task.lastUpdatedAt;

      // Small delay to ensure timestamp difference
      const updated = updateTaskStatus(task, 'in_progress');

      expect(updated.status).toBe('in_progress');
      expect(updated.lastUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('should set startedAt when moving to in_progress', () => {
      const task = createTask({ name: 'test', description: 'Test' });
      expect(task.startedAt).toBeUndefined();

      const updated = updateTaskStatus(task, 'in_progress');

      expect(updated.startedAt).toBeDefined();
    });

    it('should set completedAt when moving to completed', () => {
      const task: Task = {
        ...createTask({ name: 'test', description: 'Test' }),
        status: 'in_progress',
      };

      const updated = updateTaskStatus(task, 'completed');

      expect(updated.completedAt).toBeDefined();
    });

    it('should set completedAt when moving to failed', () => {
      const task: Task = {
        ...createTask({ name: 'test', description: 'Test' }),
        status: 'in_progress',
      };

      const updated = updateTaskStatus(task, 'failed');

      expect(updated.completedAt).toBeDefined();
    });

    it('should increment attempts when retrying', () => {
      const task = createTask({ name: 'test', description: 'Test' });
      expect(task.attempts).toBe(0);

      const inProgress = updateTaskStatus(task, 'in_progress');
      expect(inProgress.attempts).toBe(1);

      // Simulate failure and retry
      const failed = updateTaskStatus(inProgress, 'failed');
      const retried = updateTaskStatus(failed, 'in_progress');
      expect(retried.attempts).toBe(2);
    });
  });

  describe('isTaskBlocked', () => {
    it('should return false for task with no dependencies', () => {
      const task = createTask({ name: 'test', description: 'Test' });
      expect(isTaskBlocked(task, [])).toBe(false);
    });

    it('should return true for task with pending dependency', () => {
      const dep = createTask({ name: 'dep', description: 'Dep' });
      const task = createTask({ name: 'test', description: 'Test', dependsOn: [dep.id] });

      expect(isTaskBlocked(task, [dep, task])).toBe(true);
    });

    it('should return false for task with completed dependencies', () => {
      const dep: Task = {
        ...createTask({ name: 'dep', description: 'Dep' }),
        status: 'completed',
      };
      const task = createTask({ name: 'test', description: 'Test', dependsOn: [dep.id] });

      expect(isTaskBlocked(task, [dep, task])).toBe(false);
    });

    it('should return true for task with failed dependency', () => {
      const dep: Task = {
        ...createTask({ name: 'dep', description: 'Dep' }),
        status: 'failed',
      };
      const task = createTask({ name: 'test', description: 'Test', dependsOn: [dep.id] });

      expect(isTaskBlocked(task, [dep, task])).toBe(true);
    });
  });

  describe('getTaskDependencies', () => {
    it('should return empty array for task with no dependencies', () => {
      const task = createTask({ name: 'test', description: 'Test' });
      const deps = getTaskDependencies(task, [task]);

      expect(deps).toEqual([]);
    });

    it('should return dependency tasks', () => {
      const dep1 = createTask({ name: 'dep1', description: 'Dep 1' });
      const dep2 = createTask({ name: 'dep2', description: 'Dep 2' });
      const task = createTask({
        name: 'test',
        description: 'Test',
        dependsOn: [dep1.id, dep2.id],
      });

      const deps = getTaskDependencies(task, [dep1, dep2, task]);

      expect(deps).toHaveLength(2);
      expect(deps.map((d) => d.id)).toContain(dep1.id);
      expect(deps.map((d) => d.id)).toContain(dep2.id);
    });
  });

  describe('Task status types', () => {
    it('should have all expected statuses', () => {
      const statuses: TaskStatus[] = [
        'pending',
        'blocked',
        'in_progress',
        'waiting_external',
        'completed',
        'failed',
        'skipped',
        'cancelled',
      ];

      statuses.forEach((status) => {
        const task: Task = { ...createTask({ name: 'test', description: 'Test' }), status };
        expect(task.status).toBe(status);
      });
    });
  });

  describe('Plan status types', () => {
    it('should have all expected statuses', () => {
      const statuses: PlanStatus[] = ['pending', 'running', 'suspended', 'completed', 'failed', 'cancelled'];

      statuses.forEach((status) => {
        const plan: Plan = { ...createPlan({ goal: 'Test', tasks: [] }), status };
        expect(plan.status).toBe(status);
      });
    });
  });

  // ============ Phase 1: Dependency Cycle Detection Tests ============
  describe('detectDependencyCycle', () => {
    it('should return null for tasks with no dependencies', () => {
      const tasks = [
        createTask({ id: 'task-1', name: 'Task 1', description: 'First' }),
        createTask({ id: 'task-2', name: 'Task 2', description: 'Second' }),
        createTask({ id: 'task-3', name: 'Task 3', description: 'Third' }),
      ];

      const cycle = detectDependencyCycle(tasks);
      expect(cycle).toBeNull();
    });

    it('should return null for valid DAG (no cycles)', () => {
      const tasks = [
        createTask({ id: 'task-1', name: 'Task 1', description: 'First', dependsOn: [] }),
        createTask({ id: 'task-2', name: 'Task 2', description: 'Second', dependsOn: ['task-1'] }),
        createTask({ id: 'task-3', name: 'Task 3', description: 'Third', dependsOn: ['task-1', 'task-2'] }),
      ];

      const cycle = detectDependencyCycle(tasks);
      expect(cycle).toBeNull();
    });

    it('should detect simple A -> B -> A cycle', () => {
      const tasks = [
        createTask({ id: 'task-a', name: 'Task A', description: 'A', dependsOn: ['task-b'] }),
        createTask({ id: 'task-b', name: 'Task B', description: 'B', dependsOn: ['task-a'] }),
      ];

      const cycle = detectDependencyCycle(tasks);
      expect(cycle).not.toBeNull();
      expect(cycle).toHaveLength(3); // A -> B -> A
      expect(cycle![0]).toBe(cycle![cycle!.length - 1]); // Cycle starts and ends with same task
    });

    it('should detect A -> B -> C -> A cycle', () => {
      const tasks = [
        createTask({ id: 'task-a', name: 'Task A', description: 'A', dependsOn: ['task-c'] }),
        createTask({ id: 'task-b', name: 'Task B', description: 'B', dependsOn: ['task-a'] }),
        createTask({ id: 'task-c', name: 'Task C', description: 'C', dependsOn: ['task-b'] }),
      ];

      const cycle = detectDependencyCycle(tasks);
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect self-referencing task', () => {
      const tasks = [
        createTask({ id: 'task-self', name: 'Self', description: 'Self-ref', dependsOn: ['task-self'] }),
      ];

      const cycle = detectDependencyCycle(tasks);
      expect(cycle).not.toBeNull();
      expect(cycle).toContain('task-self');
    });

    it('should handle complex graph with partial cycle', () => {
      // Graph: A -> B -> C (no cycle)
      //        D -> E -> F -> D (cycle)
      const tasks = [
        createTask({ id: 'task-a', name: 'A', description: 'A', dependsOn: [] }),
        createTask({ id: 'task-b', name: 'B', description: 'B', dependsOn: ['task-a'] }),
        createTask({ id: 'task-c', name: 'C', description: 'C', dependsOn: ['task-b'] }),
        createTask({ id: 'task-d', name: 'D', description: 'D', dependsOn: ['task-f'] }),
        createTask({ id: 'task-e', name: 'E', description: 'E', dependsOn: ['task-d'] }),
        createTask({ id: 'task-f', name: 'F', description: 'F', dependsOn: ['task-e'] }),
      ];

      const cycle = detectDependencyCycle(tasks);
      expect(cycle).not.toBeNull();
      // Cycle should be in D, E, F
      const cycleIds = new Set(cycle);
      expect(cycleIds.has('task-d') || cycleIds.has('task-e') || cycleIds.has('task-f')).toBe(true);
    });

    it('should handle dependencies on non-existent tasks gracefully', () => {
      const tasks = [
        createTask({ id: 'task-1', name: 'Task 1', description: 'First', dependsOn: ['non-existent'] }),
      ];

      // Should not throw, non-existent dependencies are just skipped
      const cycle = detectDependencyCycle(tasks);
      expect(cycle).toBeNull();
    });

    it('should handle empty task list', () => {
      const cycle = detectDependencyCycle([]);
      expect(cycle).toBeNull();
    });

    it('should detect cycle in diamond dependency with back-edge', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D -> A (creates cycle)
      const tasks = [
        createTask({ id: 'task-a', name: 'A', description: 'A', dependsOn: ['task-d'] }),
        createTask({ id: 'task-b', name: 'B', description: 'B', dependsOn: ['task-a'] }),
        createTask({ id: 'task-c', name: 'C', description: 'C', dependsOn: ['task-a'] }),
        createTask({ id: 'task-d', name: 'D', description: 'D', dependsOn: ['task-b', 'task-c'] }),
      ];

      const cycle = detectDependencyCycle(tasks);
      expect(cycle).not.toBeNull();
    });
  });

  describe('createPlan with cycle detection', () => {
    it('should throw DependencyCycleError when cycle is detected', () => {
      const taskInputs = [
        { id: 'task-a', name: 'A', description: 'A', dependsOn: ['task-b'] },
        { id: 'task-b', name: 'B', description: 'B', dependsOn: ['task-a'] },
      ];

      expect(() => createPlan({ goal: 'Test', tasks: taskInputs })).toThrow(DependencyCycleError);
    });

    it('should include cycle path in error', () => {
      const taskInputs = [
        { id: 'task-a', name: 'A', description: 'A', dependsOn: ['task-b'] },
        { id: 'task-b', name: 'B', description: 'B', dependsOn: ['task-a'] },
      ];

      try {
        createPlan({ goal: 'Test', tasks: taskInputs });
        expect.fail('Should have thrown DependencyCycleError');
      } catch (error) {
        expect(error).toBeInstanceOf(DependencyCycleError);
        const cycleError = error as DependencyCycleError;
        expect(cycleError.cycle).toBeDefined();
        expect(cycleError.cycle.length).toBeGreaterThanOrEqual(2);
        expect(cycleError.message).toContain('Dependency cycle detected');
      }
    });

    it('should allow cycle detection to be skipped', () => {
      const taskInputs = [
        { id: 'task-a', name: 'A', description: 'A', dependsOn: ['task-b'] },
        { id: 'task-b', name: 'B', description: 'B', dependsOn: ['task-a'] },
      ];

      // Should not throw when skipCycleCheck is true
      const plan = createPlan({ goal: 'Test', tasks: taskInputs, skipCycleCheck: true });
      expect(plan).toBeDefined();
      expect(plan.tasks).toHaveLength(2);
    });

    it('should succeed for valid plan without cycles', () => {
      const taskInputs = [
        { id: 'task-a', name: 'A', description: 'A', dependsOn: [] },
        { id: 'task-b', name: 'B', description: 'B', dependsOn: ['task-a'] },
        { id: 'task-c', name: 'C', description: 'C', dependsOn: ['task-a', 'task-b'] },
      ];

      const plan = createPlan({ goal: 'Test', tasks: taskInputs });
      expect(plan).toBeDefined();
      expect(plan.tasks).toHaveLength(3);
    });
  });

  // ============ Phase 1: Task Validation Types Tests ============
  describe('TaskValidation types', () => {
    it('should create task with validation config', () => {
      const validation: TaskValidation = {
        completionCriteria: [
          'Response contains weather data',
          'Temperature is included in the response',
        ],
        minCompletionScore: 85,
        requireUserApproval: 'uncertain',
        mode: 'strict',
      };

      const task = createTask({
        name: 'get_weather',
        description: 'Get weather data',
        validation,
      });

      expect(task.validation).toBeDefined();
      expect(task.validation!.completionCriteria).toHaveLength(2);
      expect(task.validation!.minCompletionScore).toBe(85);
      expect(task.validation!.requireUserApproval).toBe('uncertain');
      expect(task.validation!.mode).toBe('strict');
    });

    it('should create task with required memory keys', () => {
      const task = createTask({
        name: 'process_data',
        description: 'Process data',
        validation: {
          requiredMemoryKeys: ['user_data', 'processed_results'],
        },
      });

      expect(task.validation!.requiredMemoryKeys).toEqual(['user_data', 'processed_results']);
    });

    it('should create task with skipReflection', () => {
      const task = createTask({
        name: 'simple_task',
        description: 'Simple task',
        validation: {
          skipReflection: true,
        },
      });

      expect(task.validation!.skipReflection).toBe(true);
    });

    it('should support all requireUserApproval modes', () => {
      const modes: Array<'never' | 'uncertain' | 'always'> = ['never', 'uncertain', 'always'];

      modes.forEach((mode) => {
        const task = createTask({
          name: 'test',
          description: 'Test',
          validation: { requireUserApproval: mode },
        });
        expect(task.validation!.requireUserApproval).toBe(mode);
      });
    });

    it('should support validation result fields in task result', () => {
      const task = createTask({
        name: 'test',
        description: 'Test',
      });

      // Simulate completed task with validation result
      task.result = {
        success: true,
        output: 'Task completed',
        validationScore: 92,
        validationExplanation: 'All criteria met',
      };

      expect(task.result.validationScore).toBe(92);
      expect(task.result.validationExplanation).toBe('All criteria met');
    });
  });
});
