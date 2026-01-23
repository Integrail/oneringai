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
  createTask,
  createPlan,
  canTaskExecute,
  getNextExecutableTasks,
  evaluateCondition,
  updateTaskStatus,
  isTaskBlocked,
  getTaskDependencies,
  resolveDependencies,
} from '@/domain/entities/Task.js';

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
});
