/**
 * PlanPlugin Tests
 * Tests for the plan context plugin
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PlanPlugin } from '../../../../../src/core/context/plugins/PlanPlugin.js';
import type { Plan, Task, TaskStatus } from '../../../../../src/domain/entities/Task.js';

describe('PlanPlugin', () => {
  let plugin: PlanPlugin;

  const createTask = (
    overrides: Partial<Task> = {}
  ): Task => ({
    id: `task-${Math.random().toString(36).substring(7)}`,
    name: 'test_task',
    description: 'A test task',
    status: 'pending',
    ...overrides,
  });

  const createPlan = (
    overrides: Partial<Plan> = {},
    tasks?: Task[]
  ): Plan => ({
    id: `plan-${Math.random().toString(36).substring(7)}`,
    goal: 'Test goal',
    tasks: tasks ?? [createTask()],
    createdAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    plugin = new PlanPlugin();
  });

  // ============================================================================
  // Constructor and Properties Tests
  // ============================================================================

  describe('constructor and properties', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('plan');
    });

    it('should have low priority (keep critical)', () => {
      expect(plugin.priority).toBe(1);
    });

    it('should not be compactable', () => {
      expect(plugin.compactable).toBe(false);
    });

    it('should start with null plan', () => {
      expect(plugin.getPlan()).toBeNull();
    });
  });

  // ============================================================================
  // Plan Management Tests
  // ============================================================================

  describe('setPlan/getPlan', () => {
    it('should set and get plan', () => {
      const plan = createPlan();
      plugin.setPlan(plan);

      expect(plugin.getPlan()).toBe(plan);
    });

    it('should overwrite existing plan', () => {
      const plan1 = createPlan({ goal: 'Goal 1' });
      const plan2 = createPlan({ goal: 'Goal 2' });

      plugin.setPlan(plan1);
      plugin.setPlan(plan2);

      expect(plugin.getPlan()?.goal).toBe('Goal 2');
    });
  });

  describe('clearPlan', () => {
    it('should clear the plan', () => {
      plugin.setPlan(createPlan());
      expect(plugin.getPlan()).not.toBeNull();

      plugin.clearPlan();
      expect(plugin.getPlan()).toBeNull();
    });

    it('should be safe to call when no plan', () => {
      expect(() => plugin.clearPlan()).not.toThrow();
    });
  });

  // ============================================================================
  // Task Management Tests
  // ============================================================================

  describe('updateTaskStatus', () => {
    it('should update task status by id', () => {
      const task = createTask({ id: 'task-1', status: 'pending' });
      const plan = createPlan({}, [task]);
      plugin.setPlan(plan);

      plugin.updateTaskStatus('task-1', 'in_progress');

      expect(plugin.getTask('task-1')?.status).toBe('in_progress');
    });

    it('should update task status by name', () => {
      const task = createTask({ name: 'my_task', status: 'pending' });
      const plan = createPlan({}, [task]);
      plugin.setPlan(plan);

      plugin.updateTaskStatus('my_task', 'completed');

      expect(plugin.getTask('my_task')?.status).toBe('completed');
    });

    it('should not throw when task not found', () => {
      plugin.setPlan(createPlan());
      expect(() => plugin.updateTaskStatus('non_existent', 'completed')).not.toThrow();
    });

    it('should not throw when no plan', () => {
      expect(() => plugin.updateTaskStatus('task-1', 'completed')).not.toThrow();
    });

    it('should update to all valid statuses', () => {
      const task = createTask({ id: 'task-1' });
      plugin.setPlan(createPlan({}, [task]));

      const statuses: TaskStatus[] = ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'blocked'];

      for (const status of statuses) {
        plugin.updateTaskStatus('task-1', status);
        expect(plugin.getTask('task-1')?.status).toBe(status);
      }
    });
  });

  describe('getTask', () => {
    it('should get task by id', () => {
      const task = createTask({ id: 'unique-id', name: 'task_name' });
      plugin.setPlan(createPlan({}, [task]));

      const found = plugin.getTask('unique-id');
      expect(found?.name).toBe('task_name');
    });

    it('should get task by name', () => {
      const task = createTask({ name: 'find_me' });
      plugin.setPlan(createPlan({}, [task]));

      const found = plugin.getTask('find_me');
      expect(found).toBeDefined();
    });

    it('should return undefined for non-existent task', () => {
      plugin.setPlan(createPlan());
      expect(plugin.getTask('non_existent')).toBeUndefined();
    });

    it('should return undefined when no plan', () => {
      expect(plugin.getTask('any')).toBeUndefined();
    });
  });

  // ============================================================================
  // isComplete Tests
  // ============================================================================

  describe('isComplete', () => {
    it('should return true when all tasks completed', () => {
      const tasks = [
        createTask({ status: 'completed' }),
        createTask({ status: 'completed' }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      expect(plugin.isComplete()).toBe(true);
    });

    it('should return true when all tasks skipped', () => {
      const tasks = [
        createTask({ status: 'skipped' }),
        createTask({ status: 'skipped' }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      expect(plugin.isComplete()).toBe(true);
    });

    it('should return true with mix of completed and skipped', () => {
      const tasks = [
        createTask({ status: 'completed' }),
        createTask({ status: 'skipped' }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      expect(plugin.isComplete()).toBe(true);
    });

    it('should return false when any task pending', () => {
      const tasks = [
        createTask({ status: 'completed' }),
        createTask({ status: 'pending' }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      expect(plugin.isComplete()).toBe(false);
    });

    it('should return false when any task in_progress', () => {
      const tasks = [
        createTask({ status: 'completed' }),
        createTask({ status: 'in_progress' }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      expect(plugin.isComplete()).toBe(false);
    });

    it('should return false when any task failed', () => {
      const tasks = [
        createTask({ status: 'completed' }),
        createTask({ status: 'failed' }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      expect(plugin.isComplete()).toBe(false);
    });

    it('should return false when any task blocked', () => {
      const tasks = [
        createTask({ status: 'completed' }),
        createTask({ status: 'blocked' }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      expect(plugin.isComplete()).toBe(false);
    });

    it('should return true when no plan', () => {
      expect(plugin.isComplete()).toBe(true);
    });

    it('should return true when plan has no tasks', () => {
      plugin.setPlan(createPlan({}, []));
      expect(plugin.isComplete()).toBe(true);
    });
  });

  // ============================================================================
  // getComponent Tests
  // ============================================================================

  describe('getComponent', () => {
    it('should return null when no plan', async () => {
      const component = await plugin.getComponent();
      expect(component).toBeNull();
    });

    it('should return component with plan content', async () => {
      const plan = createPlan({ goal: 'Test goal' }, [
        createTask({ name: 'task_1', description: 'First task' }),
      ]);
      plugin.setPlan(plan);

      const component = await plugin.getComponent();

      expect(component).not.toBeNull();
      expect(component?.name).toBe('plan');
      expect(component?.priority).toBe(1);
      expect(component?.compactable).toBe(false);
    });

    it('should format plan content with goal', async () => {
      const plan = createPlan({ goal: 'Complete the mission' });
      plugin.setPlan(plan);

      const component = await plugin.getComponent();

      expect(component?.content).toContain('## Current Plan');
      expect(component?.content).toContain('**Goal**: Complete the mission');
    });

    it('should format tasks with status', async () => {
      const tasks = [
        createTask({ name: 'task_1', description: 'First task', status: 'pending' }),
        createTask({ name: 'task_2', description: 'Second task', status: 'in_progress' }),
        createTask({ name: 'task_3', description: 'Third task', status: 'completed' }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      const component = await plugin.getComponent();

      expect(component?.content).toContain('[ ] [pending]');
      expect(component?.content).toContain('[~] [in_progress]');
      expect(component?.content).toContain('[x] [completed]');
    });

    it('should format failed status', async () => {
      const tasks = [createTask({ status: 'failed' })];
      plugin.setPlan(createPlan({}, tasks));

      const component = await plugin.getComponent();
      expect(component?.content).toContain('[!] [failed]');
    });

    it('should format skipped status', async () => {
      const tasks = [createTask({ status: 'skipped' })];
      plugin.setPlan(createPlan({}, tasks));

      const component = await plugin.getComponent();
      expect(component?.content).toContain('[-] [skipped]');
    });

    it('should format blocked status', async () => {
      const tasks = [createTask({ status: 'blocked' })];
      plugin.setPlan(createPlan({}, tasks));

      const component = await plugin.getComponent();
      expect(component?.content).toContain('[#] [blocked]');
    });

    it('should include task dependencies', async () => {
      const tasks = [
        createTask({ name: 'task_1' }),
        createTask({ name: 'task_2', dependsOn: ['task_1'] }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      const component = await plugin.getComponent();
      expect(component?.content).toContain('(depends on: task_1)');
    });

    it('should include multiple dependencies', async () => {
      const tasks = [
        createTask({ name: 'task_1' }),
        createTask({ name: 'task_2' }),
        createTask({ name: 'task_3', dependsOn: ['task_1', 'task_2'] }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      const component = await plugin.getComponent();
      expect(component?.content).toContain('(depends on: task_1, task_2)');
    });

    it('should include completion criteria when present', async () => {
      const tasks = [
        createTask({
          name: 'task_1',
          validation: {
            completionCriteria: 'All tests pass',
          },
        }),
      ];
      plugin.setPlan(createPlan({}, tasks));

      const component = await plugin.getComponent();
      expect(component?.content).toContain('- Completion: All tests pass');
    });

    it('should include metadata with counts', async () => {
      const tasks = [
        createTask({ status: 'completed' }),
        createTask({ status: 'completed' }),
        createTask({ status: 'pending' }),
      ];
      plugin.setPlan(createPlan({ goal: 'Test' }, tasks));

      const component = await plugin.getComponent();

      expect(component?.metadata?.taskCount).toBe(3);
      expect(component?.metadata?.completedCount).toBe(2);
      expect(component?.metadata?.goal).toBe('Test');
    });
  });

  // ============================================================================
  // State Persistence Tests
  // ============================================================================

  describe('getState/restoreState', () => {
    it('should return plan in state', () => {
      const plan = createPlan({ goal: 'Save me' });
      plugin.setPlan(plan);

      const state = plugin.getState();
      expect(state.plan).toBe(plan);
    });

    it('should return null plan when empty', () => {
      const state = plugin.getState();
      expect(state.plan).toBeNull();
    });

    it('should restore plan from state', () => {
      const plan = createPlan({ goal: 'Restored goal' });
      const state = { plan };

      plugin.restoreState(state);

      expect(plugin.getPlan()?.goal).toBe('Restored goal');
    });

    it('should not restore from null state', () => {
      plugin.setPlan(createPlan({ goal: 'Original' }));
      plugin.restoreState(null);

      // Should keep original
      expect(plugin.getPlan()?.goal).toBe('Original');
    });

    it('should not restore from state without plan', () => {
      plugin.setPlan(createPlan({ goal: 'Original' }));
      plugin.restoreState({});

      // Should keep original since state.plan is undefined
      expect(plugin.getPlan()?.goal).toBe('Original');
    });

    it('should round-trip correctly', () => {
      const plan = createPlan({ goal: 'Round trip' }, [
        createTask({ id: 'task-1', name: 'Task One', status: 'completed' }),
        createTask({ id: 'task-2', name: 'Task Two', status: 'pending' }),
      ]);
      plugin.setPlan(plan);

      const state = plugin.getState();

      const newPlugin = new PlanPlugin();
      newPlugin.restoreState(state);

      expect(newPlugin.getPlan()?.goal).toBe('Round trip');
      expect(newPlugin.getPlan()?.tasks).toHaveLength(2);
      expect(newPlugin.getTask('task-1')?.status).toBe('completed');
      expect(newPlugin.getTask('task-2')?.status).toBe('pending');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle task without status', async () => {
      const task = createTask();
      delete (task as any).status;
      plugin.setPlan(createPlan({}, [task]));

      const component = await plugin.getComponent();
      expect(component?.content).toContain('[pending]');
    });

    it('should handle empty task list', async () => {
      plugin.setPlan(createPlan({}, []));

      const component = await plugin.getComponent();
      expect(component).not.toBeNull();
      expect(component?.content).toContain('**Tasks**:');
    });

    it('should handle task with empty dependsOn array', async () => {
      const task = createTask({ dependsOn: [] });
      plugin.setPlan(createPlan({}, [task]));

      const component = await plugin.getComponent();
      expect(component?.content).not.toContain('depends on');
    });
  });
});
