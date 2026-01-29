/**
 * TaskAgent Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskAgent, TaskAgentConfig, TaskAgentHooks, PlanUpdates } from '../../../src/capabilities/taskAgent/TaskAgent.js';
import { Connector, Vendor } from '../../../src/core/index.js';
import { createAgentStorage } from '../../../src/infrastructure/storage/InMemoryStorage.js';
import type { Plan, Task, PlanInput } from '../../../src/domain/entities/Task.js';

// Mock the Agent class
vi.mock('../../../src/core/Agent.js', () => ({
  Agent: {
    create: vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue({
        output_text: 'Task completed',
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      }),
      model: 'gpt-4',
      getMetrics: vi.fn().mockReturnValue({ toolCallCount: 0 }),
      destroy: vi.fn(),
    }),
  },
}));

// Mock model info
vi.mock('../../../src/domain/entities/Model.js', () => ({
  getModelInfo: vi.fn().mockReturnValue({
    features: {
      input: { tokens: 128000 },
      output: { tokens: 4096 },
    },
  }),
  calculateCost: vi.fn().mockReturnValue(0.01),
}));

describe('TaskAgent', () => {
  let config: TaskAgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create test connector
    Connector.create({
      name: 'test-connector',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test-key' },
    });

    config = {
      connector: 'test-connector',
      model: 'gpt-4',
      tools: [],
      storage: createAgentStorage({}),
    };
  });

  afterEach(() => {
    Connector.clear();
  });

  // ============================================================================
  // Factory Method Tests
  // ============================================================================

  describe('create()', () => {
    it('should create a TaskAgent instance', () => {
      const agent = TaskAgent.create(config);

      expect(agent).toBeInstanceOf(TaskAgent);
      expect(agent.id).toBeDefined();
      expect(agent.id).toMatch(/^task-agent-/);
    });

    it('should throw error when connector not found', () => {
      expect(() => TaskAgent.create({
        ...config,
        connector: 'non-existent',
      })).toThrow(/Connector.*non-existent.*not found/);
    });

    it('should accept Connector instance', () => {
      const connector = Connector.get('test-connector');
      const agent = TaskAgent.create({
        ...config,
        connector: connector!,
      });

      expect(agent).toBeInstanceOf(TaskAgent);
    });

    it('should use provided storage', () => {
      const customStorage = createAgentStorage({});
      const agent = TaskAgent.create({
        ...config,
        storage: customStorage,
      });

      expect(agent).toBeDefined();
    });

    it('should use provided hooks', () => {
      const hooks: TaskAgentHooks = {
        onStart: vi.fn(),
        beforeTask: vi.fn(),
        afterTask: vi.fn(),
      };

      const agent = TaskAgent.create({
        ...config,
        hooks,
      });

      expect(agent).toBeDefined();
    });

    it('should create memory with custom config', () => {
      const agent = TaskAgent.create({
        ...config,
        memoryConfig: {
          maxSizeBytes: 512 * 1024,
          softLimitPercent: 70,
        },
      });

      expect(agent.getMemory()).toBeDefined();
    });
  });

  describe('resume()', () => {
    it('should resume agent from storage', async () => {
      // Create and start an agent first
      const agent = TaskAgent.create(config);
      await agent.start({ goal: 'Test goal', tasks: [{ name: 'Task 1', description: 'Do something' }] });

      // Save state to storage
      await config.storage!.agent.save(agent.id, agent.getState());

      // Resume from storage
      const resumedAgent = await TaskAgent.resume(agent.id, {
        storage: config.storage!,
        tools: [],
      });

      expect(resumedAgent).toBeInstanceOf(TaskAgent);
      expect(resumedAgent.id).toBe(agent.id);
    });

    it('should throw error when agent not found in storage', async () => {
      await expect(TaskAgent.resume('non-existent-id', {
        storage: config.storage!,
        tools: [],
      })).rejects.toThrow('Agent non-existent-id not found in storage');
    });

    it('should warn about missing tools', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const agent = TaskAgent.create({
        ...config,
        tools: [{
          definition: {
            type: 'function',
            function: { name: 'old_tool', description: 'Old tool', parameters: { type: 'object', properties: {} } },
          },
          execute: vi.fn(),
        }],
      });

      await agent.start({ goal: 'Test', tasks: [{ name: 'Task', description: 'Test' }] });
      await config.storage!.agent.save(agent.id, agent.getState());

      // Resume without the old tool
      await TaskAgent.resume(agent.id, {
        storage: config.storage!,
        tools: [],
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing tools from saved state: old_tool')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should log info about new tools', async () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const agent = TaskAgent.create(config);
      await agent.start({ goal: 'Test', tasks: [{ name: 'Task', description: 'Test' }] });
      await config.storage!.agent.save(agent.id, agent.getState());

      // Resume with a new tool
      await TaskAgent.resume(agent.id, {
        storage: config.storage!,
        tools: [{
          definition: {
            type: 'function',
            function: { name: 'new_tool', description: 'New tool', parameters: { type: 'object', properties: {} } },
          },
          execute: vi.fn(),
        }],
      });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('New tools not in saved state: new_tool')
      );

      consoleInfoSpy.mockRestore();
    });
  });

  // ============================================================================
  // Start Tests
  // ============================================================================

  describe('start()', () => {
    it('should start executing a plan', async () => {
      const agent = TaskAgent.create(config);
      const planInput: PlanInput = {
        goal: 'Complete task',
        tasks: [{ name: 'Task 1', description: 'First task' }],
      };

      const handle = await agent.start(planInput);

      expect(handle.agentId).toBe(agent.id);
      expect(handle.planId).toBeDefined();
    });

    it('should return a handle with wait method', async () => {
      const agent = TaskAgent.create(config);
      const handle = await agent.start({
        goal: 'Test goal',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      const result = await handle.wait();

      expect(result.status).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should return a handle with status method', async () => {
      const agent = TaskAgent.create(config);
      const handle = await agent.start({
        goal: 'Test goal',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      const status = handle.status();
      expect(['running', 'completed', 'failed', 'suspended', 'cancelled']).toContain(status);
    });

    it('should call onStart hook', async () => {
      const onStartHook = vi.fn();
      const agent = TaskAgent.create({
        ...config,
        hooks: { onStart: onStartHook },
      });

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      expect(onStartHook).toHaveBeenCalled();
    });

    it('should call onComplete hook after execution', async () => {
      const onCompleteHook = vi.fn();
      const agent = TaskAgent.create({
        ...config,
        hooks: { onComplete: onCompleteHook },
      });

      const handle = await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await handle.wait();

      expect(onCompleteHook).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Pause/Resume/Cancel Tests
  // ============================================================================

  describe('pause()', () => {
    it('should pause execution', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await agent.pause();

      expect(agent.getState().status).toBe('suspended');
    });

    it('should emit agent:suspended event', async () => {
      const agent = TaskAgent.create(config);
      const eventHandler = vi.fn();
      agent.on('agent:suspended', eventHandler);

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await agent.pause();

      expect(eventHandler).toHaveBeenCalledWith({ reason: 'manual_pause' });
    });
  });

  describe('resume()', () => {
    it('should resume paused execution', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await agent.pause();

      // Check paused state
      expect(agent.getState().status).toBe('suspended');

      // Resume starts execution which completes immediately in tests
      await agent.resume();

      // After resume and completion, status may be 'completed' or 'running'
      expect(['running', 'completed']).toContain(agent.getState().status);
    });

    it('should emit agent:resumed event', async () => {
      const agent = TaskAgent.create(config);
      const eventHandler = vi.fn();
      agent.on('agent:resumed', eventHandler);

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await agent.pause();
      await agent.resume();

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('cancel()', () => {
    it('should cancel execution', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await agent.cancel();

      expect(agent.getState().status).toBe('cancelled');
    });
  });

  // ============================================================================
  // External Dependency Tests
  // ============================================================================

  describe('triggerExternal()', () => {
    it('should trigger external dependency', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{
          name: 'Task',
          description: 'Test',
          externalDependency: {
            type: 'webhook',
            webhookId: 'test-webhook',
          },
        }],
      });

      await agent.triggerExternal('test-webhook', { data: 'value' });

      const task = agent.getPlan().tasks[0];
      expect(task.externalDependency?.state).toBe('received');
      expect(task.externalDependency?.receivedData).toEqual({ data: 'value' });
    });

    it('should throw error when no plan running', async () => {
      const agent = TaskAgent.create(config);

      // Don't start - getState will return empty plan
      await expect(agent.triggerExternal('webhook', {})).rejects.toThrow();
    });

    it('should throw error when webhook not found', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await expect(agent.triggerExternal('non-existent', {})).rejects.toThrow(
        'Task waiting on webhook non-existent not found'
      );
    });
  });

  describe('completeTaskManually()', () => {
    it('should complete task manually', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{
          name: 'Task',
          description: 'Test',
          externalDependency: {
            type: 'manual',
          },
        }],
      });

      const task = agent.getPlan().tasks[0];
      await agent.completeTaskManually(task.id, { result: 'manual' });

      expect(task.externalDependency?.state).toBe('received');
      expect(task.externalDependency?.receivedData).toEqual({ result: 'manual' });
    });

    it('should throw error when task not found', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await expect(agent.completeTaskManually('non-existent', {})).rejects.toThrow(
        'Task non-existent not found or not waiting on manual input'
      );
    });
  });

  // ============================================================================
  // Plan Update Tests
  // ============================================================================

  describe('updatePlan()', () => {
    it('should add tasks to plan', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task 1', description: 'First' }],
        allowDynamicTasks: true,
      });

      await agent.updatePlan({
        addTasks: [{ name: 'Task 2', description: 'Second' }],
      });

      expect(agent.getPlan().tasks).toHaveLength(2);
    });

    it('should update existing tasks', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task 1', description: 'Original' }],
        allowDynamicTasks: true,
      });

      const task = agent.getPlan().tasks[0];
      await agent.updatePlan({
        updateTasks: [{ id: task.id, description: 'Updated' }],
      });

      expect(agent.getPlan().tasks[0].description).toBe('Updated');
    });

    it('should remove tasks from plan', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [
          { name: 'Task 1', description: 'First' },
          { name: 'Task 2', description: 'Second' },
        ],
        allowDynamicTasks: true,
      });

      const taskId = agent.getPlan().tasks[1].id;
      await agent.updatePlan({
        removeTasks: [taskId],
      });

      expect(agent.getPlan().tasks).toHaveLength(1);
    });

    it('should throw error when dynamic tasks disabled', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
        allowDynamicTasks: false,
      });

      await expect(agent.updatePlan({
        addTasks: [{ name: 'New', description: 'New task' }],
      })).rejects.toThrow('Dynamic tasks are disabled for this plan');
    });

    it('should throw error when removing active tasks without option', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
        allowDynamicTasks: true,
      });

      // Manually set task to in_progress
      const task = agent.getPlan().tasks[0];
      task.status = 'in_progress';

      await expect(agent.updatePlan({
        removeTasks: [task.id],
      })).rejects.toThrow('Cannot remove active tasks');
    });

    it('should allow removing active tasks with option', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [
          { name: 'Task 1', description: 'First' },
          { name: 'Task 2', description: 'Second' },
        ],
        allowDynamicTasks: true,
      });

      const task = agent.getPlan().tasks[0];
      task.status = 'in_progress';

      await agent.updatePlan(
        { removeTasks: [task.id] },
        { allowRemoveActiveTasks: true }
      );

      expect(agent.getPlan().tasks).toHaveLength(1);
    });

    it('should detect dependency cycles', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [
          { name: 'Task 1', description: 'First' },
          { name: 'Task 2', description: 'Second' },
        ],
        allowDynamicTasks: true,
      });

      const [task1, task2] = agent.getPlan().tasks;

      // Create cycle: task1 depends on task2, task2 depends on task1
      await expect(agent.updatePlan({
        updateTasks: [
          { id: task1.id, dependsOn: [task2.id] },
          { id: task2.id, dependsOn: [task1.id] },
        ],
      })).rejects.toThrow();
    });

    it('should emit plan:updated event', async () => {
      const agent = TaskAgent.create(config);
      const eventHandler = vi.fn();
      agent.on('plan:updated', eventHandler);

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
        allowDynamicTasks: true,
      });

      await agent.updatePlan({
        addTasks: [{ name: 'New', description: 'New task' }],
      });

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // State Introspection Tests
  // ============================================================================

  describe('getState()', () => {
    it('should return agent state', () => {
      const agent = TaskAgent.create(config);
      const state = agent.getState();

      expect(state).toBeDefined();
      expect(state.id).toBe(agent.id);
    });
  });

  describe('getPlan()', () => {
    it('should return plan after start', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test goal',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      const plan = agent.getPlan();

      expect(plan.goal).toBe('Test goal');
      expect(plan.tasks).toHaveLength(1);
    });

    it('should throw error before start', () => {
      const agent = TaskAgent.create(config);

      expect(() => agent.getPlan()).toThrow('No plan started');
    });
  });

  describe('getMemory()', () => {
    it('should return working memory', () => {
      const agent = TaskAgent.create(config);
      const memory = agent.getMemory();

      expect(memory).toBeDefined();
    });
  });

  // ============================================================================
  // Context Access Tests
  // ============================================================================

  describe('context', () => {
    it('should provide access to memory', () => {
      const agent = TaskAgent.create(config);
      expect(agent.context.memory).toBeDefined();
    });

    it('should provide access to cache', () => {
      const agent = TaskAgent.create(config);
      expect(agent.context.cache).toBeDefined();
    });

    it('should provide access to history', () => {
      const agent = TaskAgent.create(config);
      expect(agent.context.history).toBeDefined();
    });

    it('should provide access to permissions', () => {
      const agent = TaskAgent.create(config);
      expect(agent.context.permissions).toBeDefined();
    });

    it('should provide access to tools', () => {
      const agent = TaskAgent.create(config);
      expect(agent.context.tools).toBeDefined();
    });

    it('should provide addMessage method', () => {
      const agent = TaskAgent.create(config);
      expect(() => agent.context.addMessage('user', 'Hello')).not.toThrow();
    });

    it('should provide getBudget method', async () => {
      const agent = TaskAgent.create(config);
      const budget = await agent.context.getBudget();

      expect(budget).toBeDefined();
      expect(budget.total).toBeGreaterThan(0);
    });

    it('should provide getMetrics method', async () => {
      const agent = TaskAgent.create(config);
      const metrics = await agent.context.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.historyMessageCount).toBeDefined();
      expect(metrics.memoryStats).toBeDefined();
      expect(metrics.cacheStats).toBeDefined();
    });
  });

  describe('hasContext()', () => {
    it('should return true when components initialized', () => {
      const agent = TaskAgent.create(config);
      expect(agent.hasContext()).toBe(true);
    });
  });

  // ============================================================================
  // Event Tests
  // ============================================================================

  describe('events', () => {
    it('should emit task:start event', async () => {
      const agent = TaskAgent.create(config);
      const eventHandler = vi.fn();
      agent.on('task:start', eventHandler);

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should emit memory:stored event', async () => {
      const agent = TaskAgent.create(config);
      const eventHandler = vi.fn();
      agent.on('memory:stored', eventHandler);

      const memory = agent.getMemory();
      await memory.store('test-key', 'Test description', { value: 'test' });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test-key',
          description: 'Test description',
        })
      );
    });

    it('should emit agent:completed event', async () => {
      const agent = TaskAgent.create(config);
      const eventHandler = vi.fn();
      agent.on('agent:completed', eventHandler);

      const handle = await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await handle.wait();

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Destroy Tests
  // ============================================================================

  describe('destroy()', () => {
    it('should cleanup resources', async () => {
      const agent = TaskAgent.create(config);
      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await expect(agent.destroy()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      const agent = TaskAgent.create(config);

      await agent.destroy();
      await agent.destroy();
      await agent.destroy();

      // Should not throw
    });
  });

  // ============================================================================
  // Session Tests
  // ============================================================================

  describe('session management', () => {
    it('should save session when configured', async () => {
      const sessionStorage = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
        getIndex: vi.fn().mockResolvedValue({ sessions: [] }),
      };

      const agent = TaskAgent.create({
        ...config,
        session: { storage: sessionStorage },
      });

      await agent.start({
        goal: 'Test',
        tasks: [{ name: 'Task', description: 'Test' }],
      });

      await agent.saveSession();

      expect(sessionStorage.save).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration', () => {
    it('should execute a complete plan', async () => {
      const agent = TaskAgent.create(config);

      const handle = await agent.start({
        goal: 'Complete multiple tasks',
        tasks: [
          { name: 'Task 1', description: 'First task' },
          { name: 'Task 2', description: 'Second task', dependsOn: [] },
        ],
      });

      const result = await handle.wait();

      expect(result.status).toBe('completed');
      expect(result.metrics.totalTasks).toBe(2);
    });

    it('should handle task dependencies', async () => {
      const agent = TaskAgent.create(config);

      const handle = await agent.start({
        goal: 'Test dependencies',
        tasks: [
          { name: 'Task A', description: 'First' },
          { name: 'Task B', description: 'Depends on A' },
        ],
      });

      const result = await handle.wait();

      expect(result.status).toBe('completed');
    });
  });
});
