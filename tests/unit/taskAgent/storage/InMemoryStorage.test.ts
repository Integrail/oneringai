/**
 * InMemoryStorage Tests
 * Tests for the default in-memory storage implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryStorage,
  InMemoryPlanStorage,
  InMemoryAgentStateStorage,
} from '@/infrastructure/storage/InMemoryStorage.js';
import { MemoryEntry, MemoryScope } from '@/domain/entities/Memory.js';
import { Plan, Task, createTask, createPlan } from '@/domain/entities/Task.js';
import { AgentState, AgentStatus } from '@/domain/entities/AgentState.js';

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  const createTestEntry = (
    key: string,
    scope: MemoryScope = { type: 'task', taskIds: ['default-task'] }
  ): MemoryEntry => ({
    key,
    description: `Test entry: ${key}`,
    value: { data: key },
    sizeBytes: 100,
    scope,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 0,
  });

  describe('get', () => {
    it('should return undefined for missing key', async () => {
      const result = await storage.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return stored entry', async () => {
      const entry = createTestEntry('test');
      await storage.set('test', entry);

      const result = await storage.get('test');
      expect(result).toEqual(entry);
    });
  });

  describe('set', () => {
    it('should store entry', async () => {
      const entry = createTestEntry('test');
      await storage.set('test', entry);

      const result = await storage.get('test');
      expect(result).toEqual(entry);
    });

    it('should overwrite existing entry', async () => {
      const entry1 = createTestEntry('test');
      const entry2 = { ...createTestEntry('test'), description: 'Updated' };

      await storage.set('test', entry1);
      await storage.set('test', entry2);

      const result = await storage.get('test');
      expect(result?.description).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should delete entry', async () => {
      const entry = createTestEntry('test');
      await storage.set('test', entry);
      await storage.delete('test');

      const result = await storage.get('test');
      expect(result).toBeUndefined();
    });

    it('should not throw for missing key', async () => {
      await expect(storage.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      await storage.set('test', createTestEntry('test'));
      expect(await storage.has('test')).toBe(true);
    });

    it('should return false for missing key', async () => {
      expect(await storage.has('nonexistent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when empty', async () => {
      const result = await storage.getAll();
      expect(result).toEqual([]);
    });

    it('should return all entries', async () => {
      await storage.set('a', createTestEntry('a'));
      await storage.set('b', createTestEntry('b'));
      await storage.set('c', createTestEntry('c'));

      const result = await storage.getAll();
      expect(result).toHaveLength(3);
    });
  });

  describe('getByScope', () => {
    it('should return only task-scoped entries', async () => {
      const taskScope = { type: 'task' as const, taskIds: ['test-task'] };
      await storage.set('task1', createTestEntry('task1', taskScope));
      await storage.set('task2', createTestEntry('task2', taskScope));
      await storage.set('persist', createTestEntry('persist', 'persistent'));

      // Filter by type - should match all task-scoped entries regardless of taskIds
      const result = await storage.getByScope({ type: 'task', taskIds: [] });
      expect(result).toHaveLength(2);
      expect(
        result.every((e) => typeof e.scope === 'object' && e.scope.type === 'task')
      ).toBe(true);
    });

    it('should return only persistent entries', async () => {
      const taskScope = { type: 'task' as const, taskIds: ['test-task'] };
      await storage.set('task', createTestEntry('task', taskScope));
      await storage.set('persist1', createTestEntry('persist1', 'persistent'));
      await storage.set('persist2', createTestEntry('persist2', 'persistent'));

      const result = await storage.getByScope('persistent');
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.scope === 'persistent')).toBe(true);
    });
  });

  describe('clearScope', () => {
    it('should clear only task-scoped entries', async () => {
      const taskScope = { type: 'task' as const, taskIds: ['test-task'] };
      await storage.set('task1', createTestEntry('task1', taskScope));
      await storage.set('task2', createTestEntry('task2', taskScope));
      await storage.set('persist', createTestEntry('persist', 'persistent'));

      // Clear all task-scoped entries
      await storage.clearScope({ type: 'task', taskIds: [] });

      expect(await storage.has('task1')).toBe(false);
      expect(await storage.has('task2')).toBe(false);
      expect(await storage.has('persist')).toBe(true);
    });

    it('should clear only persistent entries', async () => {
      const taskScope = { type: 'task' as const, taskIds: ['test-task'] };
      await storage.set('task', createTestEntry('task', taskScope));
      await storage.set('persist1', createTestEntry('persist1', 'persistent'));

      await storage.clearScope('persistent');

      expect(await storage.has('task')).toBe(true);
      expect(await storage.has('persist1')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await storage.set('a', createTestEntry('a'));
      await storage.set('b', createTestEntry('b'));

      await storage.clear();

      expect(await storage.getAll()).toEqual([]);
    });
  });

  describe('getTotalSize', () => {
    it('should return 0 when empty', async () => {
      expect(await storage.getTotalSize()).toBe(0);
    });

    it('should sum all entry sizes', async () => {
      const entry1 = { ...createTestEntry('a'), sizeBytes: 100 };
      const entry2 = { ...createTestEntry('b'), sizeBytes: 200 };

      await storage.set('a', entry1);
      await storage.set('b', entry2);

      expect(await storage.getTotalSize()).toBe(300);
    });
  });
});

describe('InMemoryPlanStorage', () => {
  let storage: InMemoryPlanStorage;

  beforeEach(() => {
    storage = new InMemoryPlanStorage();
  });

  describe('savePlan', () => {
    it('should save plan', async () => {
      const plan = createPlan({
        goal: 'Test goal',
        tasks: [{ name: 'task1', description: 'Task 1' }],
      });

      await storage.savePlan(plan);
      const result = await storage.getPlan(plan.id);

      expect(result).toEqual(plan);
    });

    it('should update existing plan', async () => {
      const plan = createPlan({ goal: 'Test goal', tasks: [] });
      await storage.savePlan(plan);

      const updated = { ...plan, goal: 'Updated goal' };
      await storage.savePlan(updated);

      const result = await storage.getPlan(plan.id);
      expect(result?.goal).toBe('Updated goal');
    });
  });

  describe('getPlan', () => {
    it('should return undefined for missing plan', async () => {
      const result = await storage.getPlan('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('updateTask', () => {
    it('should update task within plan', async () => {
      const plan = createPlan({
        goal: 'Test',
        tasks: [{ name: 'task1', description: 'Task 1' }],
      });
      await storage.savePlan(plan);

      const updatedTask: Task = { ...plan.tasks[0], status: 'completed' };
      await storage.updateTask(plan.id, updatedTask);

      const result = await storage.getPlan(plan.id);
      expect(result?.tasks[0].status).toBe('completed');
    });

    it('should throw for nonexistent plan', async () => {
      const task = createTask({ name: 'test', description: 'Test' });
      await expect(storage.updateTask('nonexistent', task)).rejects.toThrow();
    });
  });

  describe('addTask', () => {
    it('should add task to plan', async () => {
      const plan = createPlan({ goal: 'Test', tasks: [] });
      await storage.savePlan(plan);

      const newTask = createTask({ name: 'new', description: 'New task' });
      await storage.addTask(plan.id, newTask);

      const result = await storage.getPlan(plan.id);
      expect(result?.tasks).toHaveLength(1);
      expect(result?.tasks[0].name).toBe('new');
    });
  });

  describe('deletePlan', () => {
    it('should delete plan', async () => {
      const plan = createPlan({ goal: 'Test', tasks: [] });
      await storage.savePlan(plan);
      await storage.deletePlan(plan.id);

      expect(await storage.getPlan(plan.id)).toBeUndefined();
    });
  });

  describe('listPlans', () => {
    it('should return all plans', async () => {
      await storage.savePlan(createPlan({ goal: 'Plan 1', tasks: [] }));
      await storage.savePlan(createPlan({ goal: 'Plan 2', tasks: [] }));

      const result = await storage.listPlans();
      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const plan1 = createPlan({ goal: 'Plan 1', tasks: [] });
      const plan2 = { ...createPlan({ goal: 'Plan 2', tasks: [] }), status: 'completed' as const };

      await storage.savePlan(plan1);
      await storage.savePlan(plan2);

      const result = await storage.listPlans({ status: ['pending'] });
      expect(result).toHaveLength(1);
      expect(result[0].goal).toBe('Plan 1');
    });
  });

  describe('findByWebhookId', () => {
    it('should find plan by webhook ID', async () => {
      const plan = createPlan({
        goal: 'Test',
        tasks: [
          {
            name: 'wait',
            description: 'Wait for webhook',
            externalDependency: {
              type: 'webhook',
              webhookId: 'webhook-123',
              state: 'waiting',
            },
          },
        ],
      });
      await storage.savePlan(plan);

      const result = await storage.findByWebhookId('webhook-123');

      expect(result).toBeDefined();
      expect(result?.plan.id).toBe(plan.id);
      expect(result?.task.name).toBe('wait');
    });

    it('should return undefined for nonexistent webhook', async () => {
      const result = await storage.findByWebhookId('nonexistent');
      expect(result).toBeUndefined();
    });
  });
});

describe('InMemoryAgentStateStorage', () => {
  let storage: InMemoryAgentStateStorage;

  beforeEach(() => {
    storage = new InMemoryAgentStateStorage();
  });

  const createTestState = (id: string, status: AgentStatus = 'idle'): AgentState => ({
    id,
    status,
    config: {
      connectorName: 'test',
      model: 'gpt-4',
      toolNames: [],
    },
    plan: createPlan({ goal: 'Test', tasks: [] }),
    memoryId: `memory-${id}`,
    conversationHistory: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    metrics: {
      totalLLMCalls: 0,
      totalToolCalls: 0,
      totalTokensUsed: 0,
      totalCost: 0,
    },
  });

  describe('save', () => {
    it('should save agent state', async () => {
      const state = createTestState('agent-1');
      await storage.save(state);

      const result = await storage.load('agent-1');
      expect(result).toEqual(state);
    });
  });

  describe('load', () => {
    it('should return undefined for missing agent', async () => {
      const result = await storage.load('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete agent state', async () => {
      const state = createTestState('agent-1');
      await storage.save(state);
      await storage.delete('agent-1');

      expect(await storage.load('agent-1')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return all agents', async () => {
      await storage.save(createTestState('agent-1'));
      await storage.save(createTestState('agent-2'));

      const result = await storage.list();
      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      await storage.save(createTestState('agent-1', 'idle'));
      await storage.save(createTestState('agent-2', 'running'));
      await storage.save(createTestState('agent-3', 'completed'));

      const result = await storage.list({ status: ['running', 'suspended'] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-2');
    });
  });

  describe('patch', () => {
    it('should update specific fields', async () => {
      const state = createTestState('agent-1', 'idle');
      await storage.save(state);

      await storage.patch('agent-1', {
        status: 'running',
        startedAt: Date.now(),
      });

      const result = await storage.load('agent-1');
      expect(result?.status).toBe('running');
      expect(result?.startedAt).toBeDefined();
    });

    it('should throw for nonexistent agent', async () => {
      await expect(storage.patch('nonexistent', { status: 'running' })).rejects.toThrow();
    });
  });
});
